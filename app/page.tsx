import { getWeekBoard, getCurrentWeek, getManagerWeekMoney, WEEKLY_ALLOWANCE, MIN_BET } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import BetForm from "@/components/BetForm";
import ParlayToggle from "@/components/ParlayToggle";
import ParlaySlip from "@/components/ParlaySlip";
import { ParlayProvider } from "@/components/ParlayContext";
import StatusPill from "@/components/StatusPill";

const SEASON = 2026;

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  locked: "Locked",
  final: "Final",
};

export default async function BoardPage() {
  const currentManagerId = await getCurrentManagerId();
  const week = await getCurrentWeek(SEASON);

  if (!week) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Board</h1>
        <p className="text-sm text-muted">
          No lines yet — the sportsbook syncs from ESPN once matchups and
          projections are available for the season.
        </p>
      </div>
    );
  }

  const lines = await getWeekBoard(SEASON, week);
  const money = currentManagerId
    ? await getManagerWeekMoney(currentManagerId, SEASON, week)
    : null;
  const credit = money?.credit ?? 0;
  const balance = money?.balance ?? 0;

  return (
    <ParlayProvider>
      <div className="flex flex-col gap-6 pb-48">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Week {week} Board</h1>
            <p className="mt-1 text-sm text-muted">
              Spreads set from ESPN&apos;s live projected totals. Lines lock at
              kickoff and go final once ESPN calls the matchup. ${MIN_BET} minimum
              bet, ${WEEKLY_ALLOWANCE} credit to start each week. Pick 2+ legs to
              build a parlay.
            </p>
          </div>
          {currentManagerId && (
            <div className="flex gap-6 text-right text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Credit</div>
                <div className="text-lg font-bold tabular-nums">${credit.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted">Balance</div>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {balance >= 0 ? "+" : ""}
                  {balance.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {!currentManagerId && (
          <p className="rounded-lg border border-border-color bg-accent-soft p-3 text-sm text-accent">
            Pick your name in the top right to place bets.
          </p>
        )}
        {currentManagerId != null && credit > 0 && credit < MIN_BET && (
          <p className="rounded-lg border border-border-color bg-accent-soft p-3 text-sm text-accent">
            Only ${credit.toFixed(2)} of credit left — below the ${MIN_BET} minimum, so betting is closed until next week.
          </p>
        )}

        <div className="flex flex-col gap-4">
          {lines.map((line) => {
            const aFav = Number(line.spread) < 0;
            const isOwnMatchup =
              currentManagerId === line.team_a_id || currentManagerId === line.team_b_id;
            const canBet =
              currentManagerId != null && !isOwnMatchup && line.status === "open" && credit >= MIN_BET;
            const spreadADisplay = formatSpread(Number(line.spread));
            const spreadBDisplay = formatSpread(-Number(line.spread));

            return (
              <div key={line.id} className="rounded-lg border border-border-color bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted">{isOwnMatchup ? "Your matchup" : ""}</span>
                  <StatusPill status={line.status} label={STATUS_LABEL[line.status]} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{line.team_a_name}</span>
                      <span className={`tabular-nums ${aFav ? "font-semibold" : ""}`}>
                        {spreadADisplay} ({line.odds})
                      </span>
                    </div>
                    <div className="text-xs text-muted">{line.team_a_team}</div>
                    {line.status === "final" && (
                      <div className="text-sm tabular-nums">{Number(line.actual_a).toFixed(1)} pts</div>
                    )}
                    {canBet && (
                      <>
                        <BetForm
                          lineId={line.id}
                          sideManagerId={line.team_a_id}
                          sideLabel={line.team_a_name}
                          maxAmount={credit}
                          odds={line.odds}
                        />
                        <ParlayToggle
                          leg={{
                            lineId: line.id,
                            sideManagerId: line.team_a_id,
                            sideLabel: line.team_a_name,
                            oppLabel: line.team_b_name,
                            spreadDisplay: spreadADisplay,
                            odds: line.odds,
                          }}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 sm:border-l sm:border-border-color sm:pl-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">{line.team_b_name}</span>
                      <span className={`tabular-nums ${!aFav ? "font-semibold" : ""}`}>
                        {spreadBDisplay} ({line.odds})
                      </span>
                    </div>
                    <div className="text-xs text-muted">{line.team_b_team}</div>
                    {line.status === "final" && (
                      <div className="text-sm tabular-nums">{Number(line.actual_b).toFixed(1)} pts</div>
                    )}
                    {canBet && (
                      <>
                        <BetForm
                          lineId={line.id}
                          sideManagerId={line.team_b_id}
                          sideLabel={line.team_b_name}
                          maxAmount={credit}
                          odds={line.odds}
                        />
                        <ParlayToggle
                          leg={{
                            lineId: line.id,
                            sideManagerId: line.team_b_id,
                            sideLabel: line.team_b_name,
                            oppLabel: line.team_a_name,
                            spreadDisplay: spreadBDisplay,
                            odds: line.odds,
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ParlaySlip managerId={currentManagerId} maxAmount={credit} />
    </ParlayProvider>
  );
}
