import { getLeaderboard } from "@/lib/queries";

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-wide">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted">
          Net winnings across all settled bets, season-wide.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-border-color bg-surface">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Bets</th>
              <th className="px-4 py-3 text-right">Record</th>
              <th className="px-4 py-3 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.manager_id} className="border-t border-border-color/60">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{r.display_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.bets_placed}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.wins}-{r.losses}
                  {r.pushes ? `-${r.pushes}` : ""}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums font-medium ${
                    Number(r.net) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {Number(r.net) >= 0 ? "+$" : "-$"}
                  {Math.abs(Number(r.net)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
