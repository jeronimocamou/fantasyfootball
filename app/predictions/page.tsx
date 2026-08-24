import { getPredictedStandings } from "@/lib/analytics";

export default function PredictionsPage() {
  const standings = getPredictedStandings();
  const draftIsIn = standings.some((s) => s.roster_points != null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">2026 Power Rankings</h1>
        <p className="mt-1 text-sm text-muted">
          {draftIsIn ? (
            <>
              The 2026 draft is in the books, so this now blends two
              independent signals: each manager&apos;s historical skill
              (recency-weighted all-play win% over their last 3 seasons,
              weighted 3:2:1 toward the most recent — the schedule-luck-free
              metric from the Analytics tab) and their actual roster strength
              (every drafted player valued at their 2025 season point total;
              rookies with no 2025 data count as 0, which understates them —
              a real limitation, not a read on their talent). Both are scaled
              0–100 within the league and averaged evenly into the power
              score below. It&apos;s still a rough forecast — no lineup
              decisions, waivers, or injuries are modeled — but it knows the
              actual rosters now.
            </>
          ) : (
            <>
              The draft hasn&apos;t happened yet, so this has zero idea what
              anyone&apos;s roster will look like — it&apos;s purely a
              projection off history, using a recency-weighted blend of
              all-play win% (the schedule-luck-free skill metric from the
              Analytics tab) over each manager&apos;s last 3 seasons.
            </>
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3 text-right">Power score</th>
              <th className="px-4 py-3 text-right">Manager skill</th>
              {draftIsIn && <th className="px-4 py-3 text-right">Roster (2025 pts)</th>}
              <th className="px-4 py-3 text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.display_name} className="border-t border-border-color/60">
                <td className="px-4 py-3 text-muted">{s.predicted_rank}</td>
                <td className="px-4 py-3 font-medium">{s.team_name}</td>
                <td className="px-4 py-3 text-muted">{s.display_name}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{s.power_score}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted">{s.weighted_win_pct}%</td>
                {draftIsIn && (
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {s.roster_points != null ? `${s.roster_points} (#${s.roster_rank})` : "—"}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  {s.trend === "up" && (
                    <span className="text-emerald-600 dark:text-emerald-400">▲ rising</span>
                  )}
                  {s.trend === "down" && (
                    <span className="text-red-600 dark:text-red-400">▼ fading</span>
                  )}
                  {s.trend === "flat" && <span className="text-muted">— steady</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
