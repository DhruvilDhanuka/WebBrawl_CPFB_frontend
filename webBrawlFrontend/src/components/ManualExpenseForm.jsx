import { useState } from "react";
import { toPaise } from "../core/money";

export default function ManualExpenseForm({ memberList, onAddExpense }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState([]);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));

  const toggleParticipant = (memberId) => {
    setParticipantIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const selectAllParticipants = () => {
    setParticipantIds(memberList.map((m) => m.id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!description.trim()) {
      alert("Please enter an expense description.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    if (!payerId) {
      alert("Please select who paid for the expense.");
      return;
    }

    const actualParticipants = participantIds.length > 0 ? participantIds : memberList.map((m) => m.id);
    if (actualParticipants.length === 0) {
      alert("Please select at least one participant.");
      return;
    }

    onAddExpense({
      description: description.trim(),
      amount: toPaise(parsedAmount),
      payerId,
      participantIds: actualParticipants,
      date: expenseDate,
    });

    // Reset form
    setDescription("");
    setAmount("");
    setPayerId("");
    setParticipantIds([]);
  };

  if (memberList.length === 0) {
    return (
      <section className="bg-[#0f1422] rounded-xl shadow-xs border border-slate-800 p-5">
        <h2 className="text-lg font-bold text-white mb-2">Add Manual Expense</h2>
        <p className="text-sm text-slate-500 italic">Please add members above before creating an expense.</p>
      </section>
    );
  }

  return (
    <section className="bg-[#0f1422] rounded-xl shadow-xs border border-slate-800 p-5">
      <h2 className="text-lg font-bold text-white mb-4">Add Manual Expense</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Night Canteen, Swiggy"
              className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Paid by
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
              Date
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase">
              Split With
            </label>
            <button
              type="button"
              onClick={selectAllParticipants}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              Select All
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {memberList.map((m) => {
              const isChecked = participantIds.length === 0 || participantIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-indigo-950/60 border-indigo-800 text-indigo-300"
                      : "bg-[#0b0f17] border-slate-800 text-slate-400 hover:bg-slate-800/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleParticipant(m.id)}
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
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer shadow-xs"
        >
          Add Expense
        </button>
      </form>
    </section>
  );
}
