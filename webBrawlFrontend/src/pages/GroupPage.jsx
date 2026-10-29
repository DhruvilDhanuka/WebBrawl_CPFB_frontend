import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";
import { useState, useEffect } from "react";
import { toPaise, formatINR } from "../core/money";

import { splitAmount } from "../core/split";

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, addMember, removeMember, addExpense, deleteExpense } = useGroups();

  // Member form state
  const [newMember, setNewMember] = useState("");
  const [newMemberColor, setNewMemberColor] = useState("#3B82F6");

  // Expense form state
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState([]);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));


  //photo-capture ocr
  const [receiptImage, setReceiptImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!receiptImage) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(receiptImage);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    }

  }, [receiptImage])

  const group = groups[id];
  if (!group) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Group not found</h2>
          <p className="text-slate-500 mb-4 text-sm">This group may have been deleted or the link is invalid.</p>
          <button
            onClick={() => navigate("/")}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const members = group.members || {};
  const memberList = Object.values(members);
  const expenses = group.expenses || [];

  const handleAddMember = () => {
    if (!newMember.trim()) return;
    addMember(id, { name: newMember.trim(), color: newMemberColor.trim() });
    setNewMember("");
    setNewMemberColor("#3B82F6");
  };

  const toggleParticipant = (memberId) => {
    setParticipantIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((mid) => mid !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAllParticipants = () => {
    setParticipantIds(memberList.map((m) => m.id));
  };

  const handleAddExpense = (e) => {
    e.preventDefault();

    if (!description.trim()) {
      alert("Please enter an expense description.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    // Require explicit payer selection
    if (!payerId) {
      alert("Please select who paid for this expense.");
      return;
    }

    const actualParticipants = participantIds.length > 0 ? participantIds : memberList.map((m) => m.id);
    if (actualParticipants.length === 0) {
      alert("Please select at least one participant.");
      return;
    }

    addExpense(id, {
      description: description.trim(),
      amount: toPaise(parsedAmount), // stored in integer paise
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

  // Calculate live net balance for each member using splitAmount helper
  const balances = {};
  memberList.forEach((m) => {
    balances[m.id] = 0;
  });

  expenses.forEach((exp) => {
    // Payer is credited the full amount paid
    if (balances[exp.payerId] !== undefined) {
      balances[exp.payerId] += exp.amount;
    }

    // Split equally among participants with exact paise reconciliation using splitAmount
    const validParticipants = (exp.participantIds || []).filter((pid) => balances[pid] !== undefined);
    if (validParticipants.length > 0) {
      const shares = splitAmount(exp.amount / 100, validParticipants);
      Object.entries(shares).forEach(([memberId, sharePaise]) => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= sharePaise;
        }
      });
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 mb-1 cursor-pointer"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{group.name}</h1>
          </div>
          <span className="text-xs px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full font-mono">
            {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </span>
        </div>

        {/* SECTION 1: MEMBERS */}
        <section className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Members ({memberList.length})</h2>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Member name"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={newMemberColor}
                onChange={(e) => setNewMemberColor(e.target.value)}
                className="w-10 h-9 p-0.5 border border-slate-300 rounded-lg cursor-pointer bg-white"
                title="Pick avatar color"
              />
              <button
                onClick={handleAddMember}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Add Member
              </button>
            </div>
          </div>

          {memberList.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No members yet. Add members to start tracking expenses.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberList.map((member) => (
                <div
                  key={member.id}
                  style={{ borderColor: member.color || "#6366f1" }}
                  className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-full border bg-slate-50 text-slate-800 text-sm font-medium shadow-2xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: member.color || "#6366f1" }}
                  />
                  <span>{member.name}</span>
                  <button
                    onClick={() => removeMember(id, member.id)}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-rose-100 hover:text-rose-600 text-slate-400 text-xs transition-colors cursor-pointer"
                    title="Remove member"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: BALANCES VIEW */}
        <section className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-3">Group Balances</h2>
          {memberList.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Add members to see balance summaries.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memberList.map((m) => {
                const net = balances[m.id] || 0;
                const isPositive = net > 0;
                const isNegative = net < 0;

                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-colors ${isPositive
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : isNegative
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: m.color || "#6366f1" }}
                      />
                      <span className="font-semibold">{m.name}</span>
                    </div>

                    <span className="font-bold">
                      {isPositive && `Gets back ${formatINR(net)}`}
                      {isNegative && `Owes ${formatINR(Math.abs(net))}`}
                      {!isPositive && !isNegative && "Settled up"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION TOFIT: ADD OCR BASED INPUT */}
        <section>
          <input type="file" accept="image/*" onChange={(e) => setReceiptImage(e.target.files[0])} placeholder="Enter toscan" />
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Receipt preview"
              style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }}
            />
          )}
        </section>

        {/* SECTION 3: ADD MANUAL EXPENSE FORM */}
        <section className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Add Manual Expense</h2>

          {memberList.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Please add members above before creating an expense.</p>
          ) : (
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Night Canteen, Swiggy"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Paid by
                  </label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase">
                    Split With
                  </label>
                  <button
                    type="button"
                    onClick={selectAllParticipants}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${isChecked
                          ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                          : "bg-slate-50 border-slate-200 text-slate-500"
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
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Add Expense
              </button>
            </form>
          )}
        </section>

        {/* SECTION 4: EXPENSES LIST */}
        <section className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Expenses ({expenses.length})</h2>

          {expenses.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No expenses recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {expenses.map((exp) => {
                const payerName = members[exp.payerId]?.name || "Unknown";
                const splitNames = (exp.participantIds || [])
                  .map((pid) => members[pid]?.name)
                  .filter(Boolean)
                  .join(", ");

                return (
                  <div
                    key={exp.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                        {exp.description}
                      </h3>
                      <div className="text-xs text-slate-500 space-x-2">
                        <span>Paid by <strong className="text-slate-700">{payerName}</strong></span>
                        <span>•</span>
                        <span>{exp.date}</span>
                        {splitNames && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600">Split: {splitNames}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                        {formatINR(exp.amount)}
                      </span>
                      <button
                        onClick={() => deleteExpense(id, exp.id)}
                        className="text-xs text-slate-400 hover:text-rose-600 font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                        title="Delete expense"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
