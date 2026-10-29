import { toPaise } from "./money.js";
import { formatINR } from "./money.js";

export function splitAmount(amount, memberIds) {
  const n = memberIds.length;
  const amountPaise = toPaise(amount);

  const sharePaise = Math.floor(amountPaise / n);

  const extraPaise = amountPaise - sharePaise * n;

  const shares = {};

  for (let i = 0; i < n; i++) {
    const memberId = memberIds[i];
    if (i == 0) {
      shares[memberId] = sharePaise + extraPaise;
    } else {
      shares[memberId] = sharePaise;
    }
  }

  return shares;
}
