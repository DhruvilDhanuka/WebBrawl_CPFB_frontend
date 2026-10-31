import { generateID } from "../utils/id";
import { toPaise, formatINR } from "./money";

/**
 * @typedef {Object} ReceiptItem
 * @property {string} id
 * @property {string} name
 * @property {number} quantity
 * @property {number} unitPrice   paise
 * @property {number} totalPrice  paise
 * @property {boolean} needsReview  true when qty x price doesn't add up or a number was dropped
 *
 * @typedef {Object} ReceiptCharge
 * @property {string} id
 * @property {string} label
 * @property {number} amount  paise (negative for discounts)
 * @property {"tax"|"fee"|"discount"} kind
 */

/* ---------- 1. Cleaning helpers ---------- */

// OCR reads the rupee sign as ¥ # $ £ € etc. Remove currency markers BEFORE
// any letter->digit repair, otherwise "Rs." becomes "R5."
const CURRENCY = /(?:₹|¥|£|€|#|\$|\brs\.?|\binr\b)\s*(?=\d)/gi;
const stripCurrency = (s) => s.replace(CURRENCY, "");

const cleanBrackets = (s) =>
  s.replace(/[()\[\]{}<>]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Repairs letter/digit confusions inside numeric-looking tokens only.
 * A token must contain at least one real digit, so words like "Sos" are untouched.
 */
export function fixOcrNumericText(line) {
  if (!line || typeof line !== "string") return "";

  const joined = line
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1") // 1,250.00 -> 1250.00
    .replace(/(\d+),(\d{2})(?![\d,])/g, "$1.$2"); // 12,50 -> 12.50

  return joined
    .split(/\s+/)
    .map((token) => {
      if (!/\d/.test(token)) return token;
      if (!/^[0-9sSoODQlI|!bBzZ]+(?:[.,][0-9sSoODQlI|!bBzZ]+)?$/.test(token)) {
        return token;
      }
      return token
        .replace(/[sS]/g, "5")
        .replace(/[oODQ]/g, "0")
        .replace(/[lI|!]/g, "1")
        .replace(/[bB]/g, "8")
        .replace(/[zZ]/g, "2");
    })
    .join(" ");
}

/**
 * A lowercase copy of the row used ONLY for keyword matching (never for amounts).
 * "Tota]" -> "total". Digits become letters only when they follow a letter.
 */
function labelKey(raw) {
  return raw
    .toLowerCase()
    .replace(/[\]|!]/g, "l")
    .replace(/([a-z])1(?![\d%.])/g, "$1l")
    .replace(/([a-z])0(?![\d%.])/g, "$1o")
    .replace(/([a-z])5(?![\d%.])/g, "$1s")
    .replace(/^[^a-z0-9]+/, "")
    .trim();
}

/* ---------- 2. Row classification (tested against the label key) ---------- */

const HEADER_PATTERNS = [
  /^date\b/, /^time\b/, /^table\b/, /^waiter\b/, /^server\b/, /^cashier\b/,
  /^token\b/, /^order\b/, /^bill\b/, /^inv(oice)?\b/, /^rcpt\b/, /^receipt\b/,
  /^gstin/, /^tin\b/, /^fssai\b/, /^tel\b/, /^phone\b/, /^ph\b/, /^contact\b/,
  /^t\.?\s*no\b/, /^emp\b/, /^name\b/, /^address\b/, /^customer\b/, /^mob/,
  /^payment\b/, /^particulars\b/, /^item\s+qty/, /^welcome\b/,
  /^thank\s*you\b/, /^visit\s*again\b/, /^cash\b/, /^change\b/, /^card\b/,
  /^visa\b/, /^mastercard\b/, /^upi\b/, /@/,
];

const SUBTOTAL_RE = /\b(sub\s*total|item\s*total|food\s*total|item\s*mrp|net\s*amount)\b/;
const TOTAL_RE = /\b(grand\s*total|total|amount\s*(payable|due)|net\s*payable|bill\s*amount|you\s*pay)\b/;
const DISCOUNT_RE = /\b(discount|coupon|promo)\b/;
const TAX_RE = /\b(cgst|sgst|igst|gst|vat|cess)\b/;
const FEE_RE = /\b(service|platform|ops|fee|packing|packaging|delivery|handling|charge|tip|round\s*off)\b/;

function isHeaderOrFooter(key) {
  if (!key || key.length < 2) return true;
  return HEADER_PATTERNS.some((p) => p.test(key));
}

/* ---------- 3. Number helpers ---------- */

// "35.00", "115", "6.70". Rejects 6+ digit integers (pincodes, phone/bill numbers).
const isNumTok = (t) => /^\d+(?:\.\d{1,2})?$/.test(t) && !/^\d{6,}$/.test(t);

function lastNumber(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isNumTok(tokens[i])) return parseFloat(tokens[i]);
  }
  return null;
}

function labelFromText(text, fallback) {
  const label = text.replace(/[:;\s]*\d+(?:\.\d{1,2})?\D*$/, "").trim();
  return label || fallback;
}

/* ---------- 4. Item row parsing ---------- */

/**
 * Reads trailing numbers from the right: [qty rate amount], [qty amount], or [amount].
 * Returns null when the row doesn't look like an item.
 */
function parseItemRow(text) {
  const hadX = /\d\s*[x@*]\s*\d/i.test(text);
  const normalized = text.replace(/(\d(?:\.\d+)?)\s*[x@*]\s*(?=\d)/gi, "$1 ");
  const tokens = normalized.split(" ");

  const nums = [];
  let end = tokens.length;
  while (end > 0 && nums.length < 3 && isNumTok(tokens[end - 1])) {
    nums.unshift(parseFloat(tokens[end - 1]));
    end--;
  }
  if (nums.length === 0) return null;

  const nameRaw = tokens.slice(0, end).join(" ");
  if (/[:;]/.test(nameRaw)) return null; // labels have colons, dish names don't

  const name = nameRaw
    .replace(/^\d+[.)]\s+/, "") // "1. Burger" -> "Burger" (keeps "7 Up")
    .replace(/[\s:;|.\-_,]+$/, "")
    .trim();
  if (!/[a-z]{2}/i.test(name)) return null;

  let qty = 1;
  let unit;
  let total;
  let needsReview = false;

  if (nums.length === 3 && Number.isInteger(nums[0]) && nums[0] > 0 && nums[0] <= 99) {
    [qty, unit, total] = nums;
  } else if (nums.length >= 2) {
    if (nums.length === 3) needsReview = true; // the first number didn't fit, so it was dropped
    const [a, b] = nums.slice(-2);
    if (hadX && Number.isInteger(a) && a > 0 && a <= 99) {
      qty = a; unit = b; total = a * b;
    } else if (Number.isInteger(a) && a > 0 && a <= 20 && a !== b) {
      qty = a; total = b; unit = b / a;
    } else {
      total = b; unit = b;
      if (a !== b) needsReview = true; // a number was discarded
    }
  } else {
    const p = nums[0];
    if (Number.isInteger(p) && p < 10) return null; // probably a lone quantity from a split row
    unit = total = p;
  }

  if (!(total > 0)) return null;

  const unitPrice = toPaise(unit);
  const totalPrice = toPaise(total);
  if (Math.abs(qty * unitPrice - totalPrice) > qty) needsReview = true;

  return { id: generateID(), name, quantity: qty, unitPrice, totalPrice, needsReview };
}

/* ---------- 5. Main parser ---------- */

/**
 * @param {string} rawText  OCR text
 * @returns {{
 *  items: ReceiptItem[], charges: ReceiptCharge[], tax: number,
 *  subtotal: number, total: number, totalDetected: boolean, warnings: string[]
 * }}  all money values are integer paise
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      items: [], charges: [], tax: 0, subtotal: 0, total: 0,
      totalDetected: false, warnings: ["No text was read from the image."],
    };
  }

  const rows = rawText
    .split(/\r?\n/)
    .map((raw) => ({
      key: labelKey(raw),
      text: fixOcrNumericText(cleanBrackets(stripCurrency(raw))),
    }))
    .filter((r) => r.text);

  let detectedSubtotal = null;
  let detectedTotal = null;
  const items = [];
  const charges = [];

  const addCharge = (kind, text, key, value, sign = 1) => {
    if (value === null || !(value > 0)) return;
    charges.push({
      id: generateID(),
      label: labelFromText(text, key),
      amount: sign * toPaise(value),
      kind,
    });
  };

  for (const { key, text } of rows) {
    if (isHeaderOrFooter(key)) continue;

    const last = lastNumber(text.split(" "));

    if (SUBTOTAL_RE.test(key)) {
      if (last !== null) detectedSubtotal = toPaise(last);
      continue;
    }
    if (TOTAL_RE.test(key)) {
      if (/\b(qty|quantity|items?)\b/.test(key)) continue; // "Total Qty: 3"
      if (last !== null) detectedTotal = toPaise(last); // the last total row wins
      continue;
    }
    if (DISCOUNT_RE.test(key)) { addCharge("discount", text, key, last, -1); continue; }
    if (TAX_RE.test(key)) { addCharge("tax", text, key, last); continue; }
    if (FEE_RE.test(key)) { addCharge("fee", text, key, last); continue; }

    const item = parseItemRow(text);
    if (item) items.push(item);
  }

  const itemsSum = items.reduce((s, i) => s + i.totalPrice, 0);
  const chargesSum = charges.reduce((s, c) => s + c.amount, 0);
  const tax = charges.filter((c) => c.kind === "tax").reduce((s, c) => s + c.amount, 0);
  const expectedTotal = itemsSum + chargesSum;

  const subtotal = detectedSubtotal ?? itemsSum;
  const total = detectedTotal ?? expectedTotal;

  const warnings = [];
  if (items.length === 0) {
    warnings.push("No items were found. Add them manually.");
  }
  if (detectedTotal === null) {
    warnings.push("No total found on the receipt. It was calculated from the items and charges.");
  }
  if (detectedSubtotal !== null && detectedSubtotal !== itemsSum) {
    const diff = detectedSubtotal - itemsSum;
    warnings.push(
      `Items add up to ${formatINR(itemsSum)} but the receipt subtotal is ${formatINR(detectedSubtotal)} ` +
      `(${formatINR(Math.abs(diff))} ${diff > 0 ? "missing or misread" : "extra"}).`
    );
  } else if (detectedTotal !== null && detectedTotal !== expectedTotal) {
    warnings.push(
      `Items + charges come to ${formatINR(expectedTotal)} but the receipt total is ${formatINR(detectedTotal)}.`
    );
  }
  const reviewCount = items.filter((i) => i.needsReview).length;
  if (reviewCount) {
    warnings.push(`${reviewCount} item(s) have numbers that don't add up. Please check them.`);
  }

  return {
    items,
    charges,
    tax,
    subtotal,
    total,
    totalDetected: detectedTotal !== null,
    warnings,
  };
}