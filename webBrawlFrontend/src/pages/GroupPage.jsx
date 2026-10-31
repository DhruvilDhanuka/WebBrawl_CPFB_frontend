import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";
import { useState } from "react";
import { formatINR } from "../core/money";
import { splitAmount } from "../core/split";
import ManualExpenseForm from "../components/ManualExpenseForm";
import ReceiptScanner from "../components/ReceiptScanner";
import ExpensesList from "../components/ExpensesList";

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, addMember, removeMember, addExpense, deleteExpense } = useGroups();

  const [activeTab, setActiveTab] = useState("manual");
  const [newMember, setNewMember] = useState("");
  const [newMemberColor, setNewMemberColor] = useState("#3B82F6");

  const group = groups[id];
  if (!group) {
    return (
      <div className="min-h-screen bg-[#0b0f17] flex flex-col items-center justify-center p-4">
        <div className="bg-[#0f1422] p-6 rounded-xl shadow-sm border border-slate-800 text-center max-w-sm w-full">
          <h2 className="text-xl font-bold text-white mb-2">Group not found</h2>
          <p className="text-slate-400 mb-4 text-sm">This group may have been deleted or the link is invalid.</p>
          <button
            onClick={() => navigate("/")}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
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

  const handleAddExpense = (expenseData) => {
    addExpense(id, expenseData);
  };

  const handleDeleteExpense = (expenseId) => {
    deleteExpense(id, expenseId);
  };

  // Calculate live net balance for each member using splitAmount helper
  const balances = {};
  memberList.forEach((m) => {
    balances[m.id] = 0;
  });

  expenses.forEach((exp) => {
    if (balances[exp.payerId] !== undefined) {
      balances[exp.payerId] += exp.amount;
    }

    if (exp.shares) {
      Object.entries(exp.shares).forEach(([memberId, sharePaise]) => {
        if (balances[memberId] !== undefined) {
          balances[memberId] -= sharePaise;
        }
      });
    } else {
      const validParticipants = (exp.participantIds || []).filter((pid) => balances[pid] !== undefined);
      if (validParticipants.length > 0) {
        const shares = splitAmount(exp.amount / 100, validParticipants);
        Object.entries(shares).forEach(([memberId, sharePaise]) => {
          if (balances[memberId] !== undefined) {
            balances[memberId] -= sharePaise;
          }
        });
      }
    }
  });

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 pb-12">
      {/* Top Navbar */}
      <header className="bg-[#0f1422]/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Back to Dashboard"
            >
              ← Back
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <h1 className="font-bold text-lg text-white truncate">{group.name}</h1>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-950/70 text-indigo-300 rounded-full border border-indigo-800/60">
            {memberList.length} members
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {/* SECTION 1: MEMBERS & LIVE BALANCES */}
        <section className="bg-[#0f1422] rounded-xl shadow-xs border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white">Members & Balances</h2>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newMemberColor}
                onChange={(e) => setNewMemberColor(e.target.value)}
                className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
                title="Member badge color"
              />
              <input
                type="text"
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                placeholder="New member name..."
                className="px-3 py-1.5 bg-[#0b0f17] border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
              />
              <button
                onClick={handleAddMember}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {memberList.map((m) => {
              const balPaise = balances[m.id] || 0;
              const isPositive = balPaise > 0;
              const isZero = balPaise === 0;

              return (
                <div
                  key={m.id}
                  className="p-3 rounded-lg border border-slate-800/80 bg-[#0b0f17] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: m.color || "#3B82F6" }}
                    />
                    <span className="font-medium text-slate-200 text-sm truncate">{m.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                        isZero
                          ? "text-slate-400 bg-slate-800/80 border border-slate-700/60"
                          : isPositive
                          ? "text-emerald-300 bg-emerald-950/50 border border-emerald-800/60"
                          : "text-rose-300 bg-rose-950/50 border border-rose-800/60"
                      }`}
                    >
                      {isZero
                        ? "Settled"
                        : isPositive
                        ? `+${formatINR(balPaise)}`
                        : `-${formatINR(Math.abs(balPaise))}`}
                    </span>

                    {memberList.length > 1 && (
                      <button
                        onClick={() => removeMember(id, m.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer text-xs"
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: MODE TABS (Manual Expense vs Scan Receipt OCR) */}
        <div className="flex border border-slate-800 rounded-xl bg-[#0f1422] p-1 gap-1">
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "manual"
                ? "bg-slate-800 text-indigo-400 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Manual Expense
          </button>
          <button
            onClick={() => setActiveTab("scan")}
            className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "scan"
                ? "bg-slate-800 text-indigo-400 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Scan Receipt (OCR)
          </button>
        </div>

        {/* SECTION 3: TAB CONTENT */}
        {activeTab === "manual" ? (
          <ManualExpenseForm memberList={memberList} onAddExpense={handleAddExpense} />
        ) : (
          <ReceiptScanner memberList={memberList} onAddExpense={handleAddExpense} />
        )}

        {/* SECTION 4: EXPENSES LIST */}
        <ExpensesList
          expenses={expenses}
          members={members}
          onDeleteExpense={handleDeleteExpense}
        />
      </div>
    </div>
  );
}
