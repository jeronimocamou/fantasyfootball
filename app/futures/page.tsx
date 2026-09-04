import { getChampionshipOdds, getCurrentWeek, getManagerWeekMoney, isWeekLocked } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import FuturesBetForm from "@/components/FuturesBetForm";

const SEASON = 2026;

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

export default async function FuturesPage() {
  const currentManagerId = await getCurrentManagerId();
  const week = await getCurrentWeek(SEASON);

  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Futures</h1>
        <p className="text-sm text-muted">
          No lines yet — futures open once the season syncs from ESPN.
        </p>
      </div>
    );
  }

  const [odds, weekLocked, money] = await Promise.all([
    getChampionshipOdds(SEASON),
    isWeekLocked(SEASON, week),
    currentManagerId ? getManagerWeekMoney(currentManagerId, SEASON, week) : Promise.resolve(null),
  ]);
  const credit = money?.credit ?? 0;
  const bettingOpen = currentManagerId != null && !weekLocked && credit >= 3;

  const ranked = [...odds].sort((a, b) => b.impliedProbability - a.impliedProbability);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Futures — Championship Odds</h1>
          <p className="mt-1 text-sm text-muted">
            Who wins it all this year. Blends each team&apos;s current roster strength with last
            season&apos;s final standing. Odds drift as the real season plays out — a placed bet
            locks in whatever odds were live the moment you bet, win or lose settled by the house
            once a champion is decided.
          </p>
        </div>
        {currentManagerId && (
          <div className="text-right text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Credit</div>
            <div className="text-lg font-bold tabular-nums">${credit.toFixed(2)}</div>
          </div>
        )}
      </div>

      {!currentManagerId && (
        <p className="rounded-lg border border-border-color bg-accent-soft p-3 text-sm text-accent">
          Pick your name in the top right to place bets.
        </p>
      )}
      {currentManagerId != null && !weekLocked && credit > 0 && credit < 3 && (
        <p className="rounded-lg border border-border-color bg-accent-soft p-3 text-sm text-accent">
          Only ${credit.toFixed(2)} of credit left — below the $3 minimum, so betting is closed until
          next week.
        </p>
      )}
      {weekLocked && (
        <p className="rounded-lg border border-border-color bg-accent-soft p-3 text-sm text-accent">
          Futures betting is closed for Week {week} — games have already started. It reopens next week.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-right">Odds</th>
              <th className="px-4 py-3 text-right">Bet</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((o, i) => (
              <tr key={o.managerId} className="border-t border-border-color/60">
                <td className="px-4 py-3 text-muted">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{o.displayName}</td>
                <td className="px-4 py-3 text-muted">{o.teamName}</td>
                <td className="px-4 py-3 text-right font-display font-semibold tabular-nums">
                  {formatOdds(o.americanOdds)}
                </td>
                <td className="px-4 py-3">
                  {bettingOpen ? (
                    <div className="flex justify-end">
                      <FuturesBetForm
                        pickManagerId={o.managerId}
                        pickLabel={o.displayName}
                        maxAmount={credit}
                        odds={o.americanOdds}
                      />
                    </div>
                  ) : (
                    <span className="block text-right text-xs text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
