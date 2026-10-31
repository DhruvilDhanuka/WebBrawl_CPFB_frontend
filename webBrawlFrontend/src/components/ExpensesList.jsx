import { formatINR } from "../core/money";

export default function ExpensesList({ expenses = [], members = {}, onDeleteExpense }) {
  return (
    <section className="bg-[#0f1422] rounded-xl shadow-xs border border-slate-800 p-5">
      <h2 className="text-lg font-bold text-white mb-4">Expenses ({expenses.length})</h2>

      {expenses.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No expenses recorded yet.</p>
      ) : (
        <div className="divide-y divide-slate-800">
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
                  <h3 className="font-semibold text-white text-sm sm:text-base">
                    {exp.description}
                  </h3>
                  <div className="text-xs text-slate-400 space-x-2">
                    <span>
                      Paid by <strong className="text-slate-200">{payerName}</strong>
                    </span>
                    <span>•</span>
                    <span>{exp.date}</span>
                    {splitNames && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">Split: {splitNames}</span>
                      </>
                    )}
                  </div>

                  {exp.shares && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(exp.shares).map(([mid, sharePaise]) => (
                        <span
                          key={mid}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 font-mono"
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: members[mid]?.color || "#3B82F6" }}
                          />
                          <span>{members[mid]?.name || "Member"}:</span>
                          <span className="font-semibold text-indigo-300">{formatINR(sharePaise)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base sm:text-lg font-bold text-slate-100 font-mono">
                    {formatINR(exp.amount)}
                  </span>
                  <button
                    onClick={() => onDeleteExpense(exp.id)}
                    className="text-xs text-slate-500 hover:text-rose-400 font-medium px-2 py-1 rounded transition-colors cursor-pointer"
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
  );
}
