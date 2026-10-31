import { useState, useEffect, useMemo } from "react";
import { runOCR } from "../core/ocr";
import { parseReceiptText } from "../core/parser";
import { toPaise, formatINR } from "../core/money";
import { splitAmount } from "../core/split";

export default function ReceiptScanner({ memberList, onAddExpense, expenseDate }) {
  const [receiptImage, setReceiptImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewGrayscale, setPreviewGrayscale] = useState(true);

  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrError, setOcrError] = useState(null);

  // Structured Items & Expense Form State
  const [scannedItems, setScannedItems] = useState([]);
  const [scannedTax, setScannedTax] = useState(0);
  const [scanPayerId, setScanPayerId] = useState("");
  const [scanParticipantIds, setScanParticipantIds] = useState([]);
  const [scanExpenseDescription, setScanExpenseDescription] = useState("Receipt Expense");

  useEffect(() => {
    if (!receiptImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(receiptImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptImage]);

  const activeParticipantIds =
    scanParticipantIds.length > 0 ? scanParticipantIds : memberList.map((m) => m.id);
  const activeParticipants = memberList.filter((m) => activeParticipantIds.includes(m.id));

  const handleScan = async () => {
    if (!receiptImage) {
      alert("Please upload or capture a receipt image first.");
      return;
    }

    setOcrLoading(true);
    setOcrError(null);
    setOcrProgress(0);

    try {
      const data = await runOCR(receiptImage, setOcrProgress);
      setOcrData(data);

      // Parse with bottom-up total/tax prioritization and OCR disambiguation
      const parsed = parseReceiptText(data.text);
      const items = (parsed.items || []).map((it) => ({
        ...it,
        unitPrice: typeof it.unitPrice === "number" && it.unitPrice >= 100 ? +(it.unitPrice / 100).toFixed(2) : it.unitPrice,
        totalPrice: typeof it.totalPrice === "number" && it.totalPrice >= 100 ? +(it.totalPrice / 100).toFixed(2) : it.totalPrice,
        sharedWith: memberList.map((m) => m.id),
      }));
      setScannedItems(items);
      setScannedTax(parsed.tax ? +(parsed.tax / 100).toFixed(2) : 0);

      if (memberList.length > 0 && !scanPayerId) {
        setScanPayerId(memberList[0].id);
      }
      if (scanParticipantIds.length === 0) {
        setScanParticipantIds(memberList.map((m) => m.id));
      }
    } catch (err) {
      console.error(err);
      setOcrError("Couldn't read this image. Try a clearer photo.");
    } finally {
      setOcrLoading(false);
    }
  };

  const getConfidenceClass = (val, isNeedsReview = false) => {
    if (isNeedsReview) return "bg-rose-950/40 border-rose-800 text-rose-200";
    if (!ocrData?.words || val === undefined || val === null || val === "") {
      return "bg-[#0b0f17] border-slate-700 text-slate-100";
    }
    const str = String(val).toLowerCase().trim();
    const match = ocrData.words.find(
      (w) => w.text && (w.text.toLowerCase().includes(str) || str.includes(w.text.toLowerCase()))
    );
    const conf = match ? match.confidence : 90;
    if (conf < 60) return "bg-rose-950/40 border-rose-800 text-rose-200";
    if (conf < 80) return "bg-amber-950/40 border-amber-800 text-amber-200";
    return "bg-emerald-950/40 border-emerald-800 text-emerald-200";
  };

  const handleUpdateItem = (itemId, field, value) => {
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          const q = field === "quantity" ? parseFloat(value) || 0 : item.quantity;
          const u = field === "unitPrice" ? parseFloat(value) || 0 : item.unitPrice;
          updated.totalPrice = +(q * u).toFixed(2);
        }
        return updated;
      })
    );
  };

  const handleToggleItemParticipant = (itemId, memberId) => {
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const current = item.sharedWith !== undefined ? item.sharedWith : activeParticipantIds;
        const next = current.includes(memberId)
          ? current.filter((id) => id !== memberId)
          : [...current, memberId];
        return { ...item, sharedWith: next };
      })
    );
  };

  const handleDeleteItem = (itemId) => {
    setScannedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleAddBlankItem = () => {
    setScannedItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        name: "New Item",
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        sharedWith: [...activeParticipantIds],
      },
    ]);
  };

  const toggleScanParticipant = (memberId) => {
    setScanParticipantIds((prev) => {
      const base = prev.length > 0 ? prev : memberList.map((m) => m.id);
      return base.includes(memberId)
        ? base.filter((id) => id !== memberId)
        : [...base, memberId];
    });
  };

  const selectAllScanParticipants = () => {
    setScanParticipantIds(memberList.map((m) => m.id));
  };

  const grandTotal = +(
    scannedItems.reduce((acc, it) => acc + (parseFloat(it.totalPrice) || 0), 0) +
    (parseFloat(scannedTax) || 0)
  ).toFixed(2);

  // Compute item splits and proportional tax allocation using existing splitAmount
  const { memberSubtotals, memberTaxShares, memberTotalShares, itemsSubtotalPaise, taxPaise } = useMemo(() => {
    const subtotals = {};
    activeParticipantIds.forEach((pid) => {
      subtotals[pid] = 0;
    });

    // 1. Split each item among its selected participants
    scannedItems.forEach((item) => {
      const itemPrice = parseFloat(item.totalPrice) || 0;
      if (itemPrice <= 0) return;

      const itemSharers = (item.sharedWith !== undefined ? item.sharedWith : activeParticipantIds).filter(
        (pid) => activeParticipantIds.includes(pid)
      );
      const effectiveSharers = itemSharers.length > 0 ? itemSharers : activeParticipantIds;

      if (effectiveSharers.length > 0) {
        const itemShares = splitAmount(itemPrice, effectiveSharers);
        Object.entries(itemShares).forEach(([pid, sharePaise]) => {
          subtotals[pid] = (subtotals[pid] || 0) + sharePaise;
        });
      }
    });

    const totalItemsPaise = Object.values(subtotals).reduce((sum, v) => sum + v, 0);
    const parsedTaxPaise = toPaise(parseFloat(scannedTax) || 0);
    const taxShares = {};
    activeParticipantIds.forEach((pid) => {
      taxShares[pid] = 0;
    });

    // 2. Proportional tax: each person pays tax proportional to their item bill
    if (parsedTaxPaise > 0) {
      if (totalItemsPaise > 0) {
        let allocatedTaxPaise = 0;
        activeParticipantIds.forEach((pid, idx) => {
          if (idx === activeParticipantIds.length - 1) {
            taxShares[pid] = parsedTaxPaise - allocatedTaxPaise;
          } else {
            const share = Math.round((subtotals[pid] / totalItemsPaise) * parsedTaxPaise);
            taxShares[pid] = share;
            allocatedTaxPaise += share;
          }
        });
      } else if (activeParticipantIds.length > 0) {
        const equalTaxShares = splitAmount(parseFloat(scannedTax) || 0, activeParticipantIds);
        Object.assign(taxShares, equalTaxShares);
      }
    }

    const totalShares = {};
    activeParticipantIds.forEach((pid) => {
      totalShares[pid] = (subtotals[pid] || 0) + (taxShares[pid] || 0);
    });

    return {
      memberSubtotals: subtotals,
      memberTaxShares: taxShares,
      memberTotalShares: totalShares,
      itemsSubtotalPaise: totalItemsPaise,
      taxPaise: parsedTaxPaise,
    };
  }, [scannedItems, scannedTax, activeParticipantIds]);

  const handleAddScannedExpense = (e) => {
    e.preventDefault();

    if (scannedItems.length === 0) {
      alert("Please add or keep at least one line item.");
      return;
    }

    if (!scanPayerId) {
      alert("Please select who paid for this receipt.");
      return;
    }

    if (activeParticipantIds.length === 0) {
      alert("Please select at least one participant to split with.");
      return;
    }

    onAddExpense({
      description: scanExpenseDescription.trim() || `Receipt (${scannedItems.length} items)`,
      amount: toPaise(grandTotal),
      payerId: scanPayerId,
      participantIds: activeParticipantIds,
      shares: memberTotalShares,
      items: scannedItems,
      date: expenseDate || new Date().toISOString().slice(0, 10),
    });

    alert(`Successfully added receipt expense of ${formatINR(toPaise(grandTotal))}!`);

    // Reset scanner state
    setScannedItems([]);
    setOcrData(null);
    setReceiptImage(null);
    setPreviewUrl(null);
  };

  return (
    <section className="bg-[#0f1422] rounded-xl shadow-xs border border-slate-800 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Scan Receipt (OCR)</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Upload or take a photo of your receipt to auto-extract items, tax, and totals.
        </p>
      </div>

      <div className="space-y-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              setReceiptImage(e.target.files[0]);
              setOcrData(null);
              setOcrError(null);
            }
          }}
          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-indigo-800/60 file:text-sm file:font-semibold file:bg-indigo-950/70 file:text-indigo-300 hover:file:bg-indigo-900 cursor-pointer"
        />

        {previewUrl && (
          <div className="border border-slate-800 rounded-lg p-3 bg-[#0b0f17] flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Grayscale Preprocessed for OCR
              </span>
              <button
                type="button"
                onClick={() => setPreviewGrayscale((prev) => !prev)}
                className="text-xs px-2.5 py-1 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium transition-colors cursor-pointer"
              >
                {previewGrayscale ? "Show Color Original" : "Show Grayscale"}
              </button>
            </div>

            <div className="max-h-96 overflow-auto border border-slate-800 rounded-lg bg-[#080c13] flex justify-center p-1">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className={`max-h-96 w-auto object-contain rounded transition-all duration-150 ${previewGrayscale ? "grayscale" : ""
                  }`}
              />
            </div>

            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleScan}
                disabled={ocrLoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-950 disabled:text-slate-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {ocrLoading ? "Scanning Receipt..." : ocrData ? "Re-run OCR" : "Run OCR"}
              </button>
            </div>
          </div>
        )}

        {/* OCR Progress Bar */}
        {ocrLoading && (
          <div className="space-y-1.5 p-3 bg-indigo-950/50 rounded-lg border border-indigo-900/50">
            <div className="flex justify-between text-xs text-indigo-300 font-semibold">
              <span>Processing with Tesseract.js (grabbing totals & rows)...</span>
              <span>{Math.round(ocrProgress * 100)}%</span>
            </div>
            <div className="w-full bg-indigo-950 rounded-full h-2 overflow-hidden border border-indigo-900/40">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${Math.round(ocrProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* OCR Error banner */}
        {ocrError && (
          <div className="p-3 bg-rose-950/40 text-rose-300 border border-rose-800/60 rounded-lg text-sm">
            {ocrError}
          </div>
        )}


        {/* Structured Items Table */}
        {ocrData && (
          <div className="mt-5 space-y-4">
            <div className="bg-[#0f1422] border border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-base">
                    Extracted Items Table
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Parsed row-by-row. You can adjust names, quantities, and prices before saving.
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="font-medium text-slate-300">Confidence:</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                      <span>High</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                      <span>Review</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
                      <span>Low</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddBlankItem}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  + Add Item
                </button>
              </div>

              {scannedItems.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-sm">
                  No individual line items parsed. Click <strong>+ Add Item</strong> to add items or check the raw text below.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase bg-[#0b0f17]">
                        <th className="py-2.5 px-3 font-semibold min-w-[170px]">Item Name</th>
                        <th className="py-2.5 px-3 font-semibold w-20">Qty</th>
                        <th className="py-2.5 px-3 font-semibold w-24">Unit (₹)</th>
                        <th className="py-2.5 px-3 font-semibold w-24 text-right">Total (₹)</th>
                        <th className="py-2.5 px-3 font-semibold min-w-[200px]">Shared By</th>
                        <th className="py-2.5 px-3 font-semibold w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {scannedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                              className={`w-full px-2.5 py-1 text-sm border rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors ${getConfidenceClass(item.name, item.needsReview)}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none text-center font-mono transition-colors ${getConfidenceClass(item.quantity)}`}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, "unitPrice", e.target.value)}
                              className={`w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-mono transition-colors ${getConfidenceClass(item.unitPrice)}`}
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-200">
                            {formatINR(toPaise(item.totalPrice))}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {activeParticipants.map((m) => {
                                const isSelected = (item.sharedWith !== undefined ? item.sharedWith : activeParticipantIds).includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleToggleItemParticipant(item.id, m.id)}
                                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 select-none ${
                                      isSelected
                                        ? "bg-indigo-950/80 border-indigo-700/80 text-indigo-300 shadow-xs"
                                        : "bg-[#0b0f17] border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 opacity-60"
                                    }`}
                                    title={`Click to ${isSelected ? "remove" : "add"} ${m.name}`}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                                      style={{ backgroundColor: m.color || "#3B82F6" }}
                                    />
                                    <span>{m.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-slate-500 hover:text-rose-400 text-xs p-1 rounded transition-colors cursor-pointer"
                              title="Delete item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary row */}
              <div className="bg-[#0b0f17] p-3 rounded-lg border border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Items: <strong className="text-slate-200">{scannedItems.length}</strong></span>
                  <span>•</span>
                  <label className="flex items-center gap-1.5">
                    <span>Tax/GST (₹):</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={scannedTax}
                      onChange={(e) => setScannedTax(parseFloat(e.target.value) || 0)}
                      className={`w-20 px-2 py-0.5 text-xs border rounded font-mono text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${getConfidenceClass(scannedTax)}`}
                    />
                  </label>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 mr-2">Grand Total:</span>
                  <span className="text-lg font-bold text-indigo-400 font-mono">
                    {formatINR(toPaise(grandTotal))}
                  </span>
                </div>
              </div>

              {/* Live Per-Person Share Breakdown */}
              {activeParticipants.length > 0 && (
                <div className="bg-[#0b0f17] p-3.5 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
                    <span className="font-semibold text-slate-200">Live Itemized Shares Breakdown</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Tax rate: {itemsSubtotalPaise > 0 ? `${((taxPaise / itemsSubtotalPaise) * 100).toFixed(1)}%` : "0%"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-0.5">
                    {activeParticipants.map((m) => {
                      const itemPaise = memberSubtotals[m.id] || 0;
                      const taxSharePaise = memberTaxShares[m.id] || 0;
                      const totalSharePaise = memberTotalShares[m.id] || 0;

                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-lg border border-slate-800/80 bg-[#0f1422] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: m.color || "#3B82F6" }}
                            />
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-200 block truncate">{m.name}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Items: {formatINR(itemPaise)} + Tax: {formatINR(taxSharePaise)}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-sm text-indigo-300 shrink-0">
                            {formatINR(totalSharePaise)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-slate-400 italic pt-1">
                    Note: Proportional-based taxes applied. Each person pays tax according to the bill that he has gotten himself into.
                  </p>
                </div>
              )}

              {/* Save as group expense form */}
              {memberList.length > 0 && (
                <form onSubmit={handleAddScannedExpense} className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                        Expense Description
                      </label>
                      <input
                        type="text"
                        value={scanExpenseDescription}
                        onChange={(e) => setScanExpenseDescription(e.target.value)}
                        placeholder="e.g. Grocery Bill, Dinner"
                        className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                        Paid By
                      </label>
                      <select
                        value={scanPayerId}
                        onChange={(e) => setScanPayerId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Select Payer --</option>
                        {memberList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-400 uppercase">
                        Split With
                      </label>
                      <button
                        type="button"
                        onClick={selectAllScanParticipants}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                      >
                        Select All
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {memberList.map((m) => {
                        const isChecked = activeParticipantIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${isChecked
                              ? "bg-indigo-950/60 border-indigo-800 text-indigo-300"
                              : "bg-[#0b0f17] border-slate-800 text-slate-400 hover:bg-slate-800/40"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleScanParticipant(m.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            {m.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                  >
                    Add to Group Expenses
                  </button>
                </form>
              )}
            </div>

            {/* Collapsible raw OCR output for debugging / transparency */}
            <details className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs">
              <summary className="font-semibold text-slate-300 cursor-pointer select-none">
                View Raw OCR Text ({ocrData.text ? `${ocrData.text.length} chars` : "0 chars"})
              </summary>
              <pre className="mt-2 text-xs font-mono bg-[#080c13] p-3 border border-slate-800 rounded text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-48">
                {ocrData.text || "No text detected."}
              </pre>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}
