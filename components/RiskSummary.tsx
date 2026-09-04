export default function RiskSummary({ atRisk, toWin }: { atRisk: number; toWin: number }) {
  return (
    <div className="flex items-center justify-end gap-8 border-t border-border-color pt-4">
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-muted">Total at risk</div>
        <div className="text-lg font-bold tabular-nums">${atRisk.toFixed(2)}</div>
      </div>
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-muted">Total to win</div>
        <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
          ${toWin.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
