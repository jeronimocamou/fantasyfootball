import { getPredictedStandings } from "@/lib/analytics";

export default function PredictionsPage() {
  const standings = getPredictedStandings();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">2026 Power Rankings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The 2026 draft hasn&apos;t happened yet, so this has zero idea what
          anyone&apos;s roster will look like — it&apos;s purely a projection off
          history. Each manager is ranked by a recency-weighted blend of their
          all-play win% (the schedule-luck-free skill metric from the Analytics
          tab) over their last 3 seasons, weighted 3:2:1 toward the most recent.
          Take it exactly as seriously as it deserves.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Projected win %</th>
              <th className="px-4 py-3 text-right">Career all-play %</th>
              <th className="px-4 py-3 text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.display_name} className="border-t border-black/5 dark:border-white/5">
                <td className="px-4 py-3 text-zinc-500">{s.predicted_rank}</td>
                <td className="px-4 py-3 font-medium">{s.team_name}</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.display_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{s.weighted_win_pct}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                  {s.career_win_pct}%
                </td>
                <td className="px-4 py-3 text-right">
                  {s.trend === "up" && (
                    <span className="text-emerald-600 dark:text-emerald-400">▲ rising</span>
                  )}
                  {s.trend === "down" && (
                    <span className="text-red-600 dark:text-red-400">▼ fading</span>
                  )}
                  {s.trend === "flat" && <span className="text-zinc-500">— steady</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
