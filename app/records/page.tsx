import { getAllMatchupsWithNames, getBestSeasonTotals } from "@/lib/db";

export default function RecordsPage() {
  const matchups = getAllMatchupsWithNames();
  const bestSeasons = getBestSeasonTotals(5);

  const byMargin = [...matchups].sort(
    (a, b) => Math.abs(b.home_score - b.away_score) - Math.abs(a.home_score - a.away_score)
  );
  const biggestBlowout = byMargin[0];
  const closestGame = byMargin[byMargin.length - 1];

  const singleWeekScores = matchups.flatMap((m) => [
    { season: m.season, week: m.week, team: m.home_name, owner: m.home_owner, score: m.home_score },
    { season: m.season, week: m.week, team: m.away_name, owner: m.away_owner, score: m.away_score },
  ]);
  const highestWeek = [...singleWeekScores].sort((a, b) => b.score - a.score)[0];
  const lowestWeek = [...singleWeekScores].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-bold tracking-tight">League Records</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <RecordCard
          label="Highest single-week score"
          value={highestWeek.score.toFixed(1)}
          detail={`${highestWeek.team} (${highestWeek.owner}) — ${highestWeek.season} Wk ${highestWeek.week}`}
        />
        <RecordCard
          label="Lowest single-week score"
          value={lowestWeek.score.toFixed(1)}
          detail={`${lowestWeek.team} (${lowestWeek.owner}) — ${lowestWeek.season} Wk ${lowestWeek.week}`}
        />
        <RecordCard
          label="Biggest blowout"
          value={Math.abs(biggestBlowout.home_score - biggestBlowout.away_score).toFixed(1)}
          detail={`${biggestBlowout.home_name} ${biggestBlowout.home_score.toFixed(1)} – ${biggestBlowout.away_score.toFixed(1)} ${biggestBlowout.away_name} (${biggestBlowout.season} Wk ${biggestBlowout.week})`}
        />
        <RecordCard
          label="Closest game"
          value={Math.abs(closestGame.home_score - closestGame.away_score).toFixed(2)}
          detail={`${closestGame.home_name} ${closestGame.home_score.toFixed(1)} – ${closestGame.away_score.toFixed(1)} ${closestGame.away_name} (${closestGame.season} Wk ${closestGame.week})`}
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Best single-season point totals</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3">Season</th>
                <th className="px-4 py-3 text-right">Record</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {bestSeasons.map((s, i) => (
                <tr key={`${s.season}-${s.team_id}`} className="border-t border-black/5 dark:border-white/5">
                  <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{s.display_name}</td>
                  <td className="px-4 py-3">{s.season}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.wins}-{s.losses}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.points_for.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RecordCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail}</div>
    </div>
  );
}
