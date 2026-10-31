import { useState, useEffect } from "react";
import { runOCR } from "../core/ocr";
import { parseReceiptText } from "../core/parser";
import { toPaise, formatINR } from "../core/money";

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
    if (isNeedsReview) return "bg-rose-50 border-rose-300 text-rose-900";
    if (!ocrData?.words || val === undefined || val === null || val === "") {
      return "bg-white border-slate-200 text-slate-800";
    }
    const str = String(val).toLowerCase().trim();
    const match = ocrData.words.find(
      (w) => w.text && (w.text.toLowerCase().includes(str) || str.includes(w.text.toLowerCase()))
    );
    const conf = match ? match.confidence : 90;
    if (conf < 60) return "bg-rose-50 border-rose-300 text-rose-900";
    if (conf < 80) return "bg-amber-50 border-amber-300 text-amber-900";
    return "bg-emerald-50/40 border-emerald-300 text-slate-800";
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
      },
    ]);
  };

  const toggleScanParticipant = (memberId) => {
    setScanParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllScanParticipants = () => {
    setScanParticipantIds(memberList.map((m) => m.id));
  };

  const grandTotal = +(
    scannedItems.reduce((acc, it) => acc + (parseFloat(it.totalPrice) || 0), 0) +
    (parseFloat(scannedTax) || 0)
  ).toFixed(2);

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

    const actualParticipants =
      scanParticipantIds.length > 0 ? scanParticipantIds : memberList.map((m) => m.id);

    if (actualParticipants.length === 0) {
      alert("Please select at least one participant to split with.");
      return;
    }

    onAddExpense({
      description: scanExpenseDescription.trim() || `Receipt (${scannedItems.length} items)`,
      amount: toPaise(grandTotal),
      payerId: scanPayerId,
      participantIds: actualParticipants,
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
    <section className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Scan Receipt (OCR)</h2>
        <p className="text-xs text-slate-500 mt-0.5">
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
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
        />

        {previewUrl && (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Grayscale Preprocessed for OCR
              </span>
              <button
                type="button"
                onClick={() => setPreviewGrayscale((prev) => !prev)}
                className="text-xs px-2.5 py-1 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium transition-colors cursor-pointer"
              >
                {previewGrayscale ? "Show Color Original" : "Show Grayscale"}
              </button>
            </div>

            <div className="max-h-96 overflow-auto border border-slate-200 rounded-lg bg-white flex justify-center p-1">
              <img
                src={previewUrl}
                alt="Receipt preview"
                className={`max-h-96 w-auto object-contain rounded transition-all duration-150 ${
                  previewGrayscale ? "grayscale" : ""
                }`}
              />
            </div>

            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleScan}
                disabled={ocrLoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {ocrLoading ? "Scanning Receipt..." : ocrData ? "Re-run OCR" : "Run OCR"}
              </button>
            </div>
          </div>
        )}

        {/* OCR Progress Bar */}
        {ocrLoading && (
          <div className="space-y-1.5 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
            <div className="flex justify-between text-xs text-indigo-700 font-semibold">
              <span>Processing with Tesseract.js (grabbing totals & rows)...</span>
              <span>{Math.round(ocrProgress * 100)}%</span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${Math.round(ocrProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* OCR Error banner */}
        {ocrError && (
          <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm">
            {ocrError}
          </div>
        )}

        {/* Structured Items Table */}
        {ocrData && (
          <div className="mt-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Extracted Items Table
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Parsed row-by-row. You can adjust names, quantities, and prices before saving.
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                      <span className="font-medium text-slate-600">Confidence:</span>
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
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    + Add Item
                  </button>
                </div>

                {scannedItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-sm">
                    No individual line items parsed. Click <strong>+ Add Item</strong> to add items or check the raw text below.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 text-xs uppercase bg-slate-50/75">
                          <th className="py-2.5 px-3 font-semibold">Item Name</th>
                          <th className="py-2.5 px-3 font-semibold w-24">Qty</th>
                          <th className="py-2.5 px-3 font-semibold w-28">Unit (₹)</th>
                          <th className="py-2.5 px-3 font-semibold w-28 text-right">Total (₹)</th>
                          <th className="py-2.5 px-3 font-semibold w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {scannedItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
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
                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                              {formatINR(toPaise(item.totalPrice))}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="text-slate-400 hover:text-rose-600 text-xs p-1 rounded transition-colors cursor-pointer"
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
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>Items: <strong>{scannedItems.length}</strong></span>
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
                    <span className="text-xs text-slate-500 mr-2">Grand Total:</span>
                    <span className="text-lg font-bold text-indigo-700 font-mono">
                      {formatINR(toPaise(grandTotal))}
                    </span>
                  </div>
                </div>

                {/* Save as group expense form */}
                {memberList.length > 0 && (
                  <form onSubmit={handleAddScannedExpense} className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                          Expense Description
                        </label>
                        <input
                          type="text"
                          value={scanExpenseDescription}
                          onChange={(e) => setScanExpenseDescription(e.target.value)}
                          placeholder="e.g. Grocery Bill, Dinner"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                          Paid By
                        </label>
                        <select
                          value={scanPayerId}
                          onChange={(e) => setScanPayerId(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                        <label className="text-xs font-semibold text-slate-600 uppercase">
                          Split With
                        </label>
                        <button
                          type="button"
                          onClick={selectAllScanParticipants}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                        >
                          Select All
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {memberList.map((m) => {
                          const isChecked = scanParticipantIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${isChecked
                                  ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
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
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      Add to Group Expenses
                    </button>
                  </form>
                )}
              </div>

              {/* Collapsible raw OCR output for debugging / transparency */}
              <details className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <summary className="font-semibold text-slate-700 cursor-pointer select-none">
                  View Raw OCR Text ({ocrData.text ? `${ocrData.text.length} chars` : "0 chars"})
                </summary>
                <pre className="mt-2 text-xs font-mono bg-white p-3 border border-slate-200 rounded text-slate-700 overflow-x-auto whitespace-pre-wrap max-h-48">
                  {ocrData.text || "No text detected."}
                </pre>
              </details>
          </div>
        )}
      </div>
    </section>
  );
}
