import {
  getLuckIndex,
  getScoringConsistency,
  getHeadToHead,
  getAllPlayRecord,
  getBenchRegret,
  getDraftValue,
  getLongestStreaks,
} from "@/lib/analytics";
import { RankedBarChart } from "@/components/AnalyticsCharts";

export default function AnalyticsPage() {
  const luck = getLuckIndex();
  const consistency = getScoringConsistency();
  const allPlay = getAllPlayRecord();
  const benchRegret = getBenchRegret();
  const draftValue = getDraftValue();
  const streaks = getLongestStreaks();
  const h2h = getHeadToHead().filter((r) => r.a_wins + r.b_wins + r.ties >= 3);

  const allPlayData = allPlay.map((r) => ({
    display_name: r.display_name,
    win_pct: Math.round((r.wins / (r.wins + r.losses)) * 1000) / 10,
    record: `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""}`,
  }));

  const biggestRivalry = [...h2h].sort(
    (a, b) => b.a_wins + b.b_wins + b.ties - (a.a_wins + a.b_wins + a.ties)
  )[0];
  const mostLopsided = [...h2h]
    .filter((r) => r.a_wins + r.b_wins + r.ties >= 5)
    .sort((a, b) => {
      const gapA = Math.abs(a.a_wins - a.b_wins) / (a.a_wins + a.b_wins + a.ties);
      const gapB = Math.abs(b.a_wins - b.b_wins) / (b.a_wins + b.b_wins + b.ties);
      return gapB - gapA;
    })[0];
  const longestWinStreak = streaks.find((s) => s.type === "win");
  const longestLossStreak = streaks.find((s) => s.type === "loss");
  const biggestBenchMistake = [...benchRegret].sort(
    (a, b) => b.worst_week_regret - a.worst_week_regret
  )[0];
  const bestSteal = draftValue[0];
  const worstBust = draftValue[draftValue.length - 1];

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The stuff your record doesn&apos;t tell you.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {biggestRivalry && (
          <HighlightCard
            label="Biggest rivalry"
            value={`${biggestRivalry.a} vs ${biggestRivalry.b}`}
            detail={`${biggestRivalry.a_wins}-${biggestRivalry.b_wins}${biggestRivalry.ties ? `-${biggestRivalry.ties}` : ""} — ${biggestRivalry.a_wins + biggestRivalry.b_wins + biggestRivalry.ties} all-time meetings, more than anyone else`}
          />
        )}
        {mostLopsided && (
          <HighlightCard
            label="Most lopsided rivalry"
            value={`${mostLopsided.a} ${mostLopsided.a_wins}-${mostLopsided.b_wins} ${mostLopsided.b}`}
            detail="One of these two owns the other, and it isn't close"
          />
        )}
        {longestWinStreak && (
          <HighlightCard
            label="Longest win streak"
            value={`${longestWinStreak.length} games`}
            detail={`${longestWinStreak.display_name}, ${longestWinStreak.start_season} Wk ${longestWinStreak.start_week} → ${longestWinStreak.end_season} Wk ${longestWinStreak.end_week}`}
          />
        )}
        {longestLossStreak && (
          <HighlightCard
            label="Longest losing streak"
            value={`${longestLossStreak.length} games`}
            detail={`${longestLossStreak.display_name}, ${longestLossStreak.start_season} Wk ${longestLossStreak.start_week} → ${longestLossStreak.end_season} Wk ${longestLossStreak.end_week}`}
          />
        )}
        {biggestBenchMistake && (
          <HighlightCard
            label="Worst bench mistake ever"
            value={`${biggestBenchMistake.worst_week_regret.toFixed(1)} pts left on the bench`}
            detail={`${biggestBenchMistake.display_name}, ${biggestBenchMistake.worst_week_season} Wk ${biggestBenchMistake.worst_week_num}`}
          />
        )}
        {bestSteal && (
          <HighlightCard
            label="Best draft steal ever"
            value={`${bestSteal.player_name} (pick ${bestSteal.overall_pick})`}
            detail={`${bestSteal.display_name}, ${bestSteal.season} — finished as the #${bestSteal.performance_rank} scorer that year`}
          />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">All-play record</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your record if you&apos;d played every team, every week, instead of just
          your actual schedule. This is the closest thing to a &quot;true skill&quot;
          ranking — no schedule luck involved.
        </p>
        <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <RankedBarChart data={allPlayData} nameKey="display_name" valueKey="win_pct" color="#378ADD" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Luck index</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Actual career wins minus &quot;expected&quot; wins (the share of the league
          a manager outscored each week). Positive = benefited from schedule,
          negative = unlucky.
        </p>
        <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <RankedBarChart
            data={[...luck].sort((a, b) => b.luck - a.luck)}
            nameKey="display_name"
            valueKey="luck"
            colorByValue
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Points left on the bench</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Career total: points your optimal lineup would have scored minus what
          you actually started. Bad lineup decisions, quantified.
        </p>
        <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <RankedBarChart
            data={[...benchRegret].sort((a, b) => b.total_regret - a.total_regret)}
            nameKey="display_name"
            valueKey="total_regret"
            color="#BA7517"
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Scoring consistency</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Standard deviation of weekly score, career-wide. Higher = boom-or-bust,
          lower = steady. (Managers under 10 games played are excluded.)
        </p>
        <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <RankedBarChart data={consistency} nameKey="display_name" valueKey="stdev" color="#7F77DD" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Draft pick value</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Value = pick number minus that player&apos;s scoring rank among all
          drafted players that season. Positive = steal, negative = bust.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <DraftValueTable title="Biggest steals" rows={draftValue.slice(0, 10)} />
          <DraftValueTable title="Biggest busts" rows={[...draftValue].reverse().slice(0, 10)} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Head-to-head</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          All-time record between managers who&apos;ve played at least 3 times.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">Matchup</th>
                <th className="px-4 py-3 text-right">Record</th>
              </tr>
            </thead>
            <tbody>
              {h2h
                .sort((a, b) => (b.a_wins + b.b_wins + b.ties) - (a.a_wins + a.b_wins + a.ties))
                .map((r) => (
                  <tr key={`${r.a}-${r.b}`} className="border-t border-black/5 dark:border-white/5">
                    <td className="px-4 py-3">
                      {r.a} vs {r.b}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.a_wins}-{r.b_wins}
                      {r.ties ? `-${r.ties}` : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HighlightCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail}</div>
    </div>
  );
}

function DraftValueTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof getDraftValue>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <div className="border-b border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10">
        {title}
      </div>
      <table className="w-full min-w-[380px] text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Manager</th>
            <th className="px-3 py-2 text-right">Pick</th>
            <th className="px-3 py-2 text-right">Finish</th>
            <th className="px-3 py-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.season}-${r.overall_pick}`}
              className="border-t border-black/5 dark:border-white/5"
            >
              <td className="px-3 py-2 font-medium">
                {r.player_name}
                <span className="ml-1 text-xs text-zinc-500">&apos;{String(r.season).slice(2)}</span>
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.display_name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.overall_pick}</td>
              <td className="px-3 py-2 text-right tabular-nums">#{r.performance_rank}</td>
              <td
                className={`px-3 py-2 text-right tabular-nums font-medium ${
                  r.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {r.value > 0 ? "+" : ""}
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
