import { formatINR } from "../core/money";

export default function ExpensesList({ expenses = [], members = {}, onDeleteExpense }) {
  return (
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
                    <span>
                      Paid by <strong className="text-slate-700">{payerName}</strong>
                    </span>
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
                    onClick={() => onDeleteExpense(exp.id)}
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
  );
}
