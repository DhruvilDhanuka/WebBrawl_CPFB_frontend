import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGroups } from "../store/GroupContext";
import { formatINR } from "../core/money";

export default function Dashboard() {
  const { groups, createGroup, deleteGroup, renameGroup } = useGroups();
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState("");

  const handleCreateGroup = (e) => {
    e?.preventDefault();
    if (!newGroupName.trim()) return;
    createGroup(newGroupName.trim());
    setNewGroupName("");
  };

  const handleRenameGroup = (group) => {
    const newName = prompt("Enter new group name:", group.name);
    if (newName && newName.trim() !== "") {
      renameGroup(group.id, newName.trim());
    }
  };

  const groupList = Object.values(groups || {});

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">WebBrawl</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Split & Scan
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            <span>{groupList.length} {groupList.length === 1 ? "group" : "groups"}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        {/* Create Group Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="max-w-xl space-y-1 mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Shared Expenses
            </h1>
            <p className="text-slate-600 text-sm">
              Create a group to track, split expenses, and scan receipts.
            </p>
          </div>

          <form onSubmit={handleCreateGroup} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={!newGroupName.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              Add a group
            </button>
          </form>
        </div>

        {/* Groups List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your Groups</h2>
            <span className="text-xs font-semibold text-slate-500">
              Showing {groupList.length}
            </span>
          </div>

          {groupList.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-2">
              <p className="font-semibold text-slate-800 text-base">No groups yet</p>
              <p className="text-sm text-slate-500">
                Enter a group name above to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupList.map((group) => {
                const memberCount = group.members ? Object.keys(group.members).length : 0;
                const expenseCount = group.expenses ? group.expenses.length : 0;
                const totalSpent = (group.expenses || []).reduce(
                  (acc, exp) => acc + (exp.amount || 0),
                  0
                );

                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-lg leading-snug truncate" title={group.name}>
                          {group.name}
                        </h3>
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {formatINR(totalSpent)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 flex gap-3">
                        <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                        <span>•</span>
                        <span>{expenseCount} {expenseCount === 1 ? "expense" : "expenses"}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/group/${group.id}`)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer text-center"
                      >
                        View Group
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRenameGroup(group)}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteGroup(group.id)}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
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
      </main>
    </div>
  );
}
