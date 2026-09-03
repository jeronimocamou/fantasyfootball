import { getManagerBets, getManagerParlays, getManagers, type BetHistoryRow, type ParlayHistoryRow } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import { profitForOdds, parlayPayout } from "@/lib/betting";
import StatusPill from "@/components/StatusPill";
import CancelledDisclosure from "@/components/CancelledDisclosure";

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
}

function BetsTable({ bets }: { bets: BetHistoryRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Week</th>
            <th className="px-4 py-3">Bet</th>
            <th className="px-4 py-3">Vs</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Status</th>
            <th className="px-4 py-3 text-right">Payout</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((b) => {
            const potentialPayout = Number(b.amount) + profitForOdds(Number(b.amount), b.odds);
            return (
              <tr key={b.id} className="border-t border-border-color/60">
                <td className="px-4 py-3 text-muted">Wk {b.week}</td>
                <td className="px-4 py-3 font-medium">{b.side_name}</td>
                <td className="px-4 py-3 text-muted">{b.opponent_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">${Number(b.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <StatusPill status={b.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {b.status === "pending" ? (
                    <span className="italic text-muted">${potentialPayout.toFixed(2)} if won</span>
                  ) : b.payout != null ? (
                    `$${Number(b.payout).toFixed(2)}`
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ParlaysList({ parlays }: { parlays: ParlayHistoryRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {parlays.map((p) => {
        const wonOrPendingOdds = p.legs.filter((l) => l.status !== "lost").map((l) => l.odds);
        const potential = parlayPayout(Number(p.amount), wonOrPendingOdds) ?? Number(p.amount);
        return (
          <div key={p.id} className="rounded-lg border border-border-color bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {p.legs.length}-leg parlay — ${Number(p.amount).toFixed(2)}
              </span>
              <span className="flex items-center gap-2">
                {p.status === "pending" ? (
                  <span className="text-xs italic text-muted">${potential.toFixed(2)} if won</span>
                ) : (
                  p.payout != null && <span className="text-xs text-muted">${Number(p.payout).toFixed(2)}</span>
                )}
                <StatusPill status={p.status} />
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {p.legs.map((leg) => (
                <div key={leg.line_id} className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    Wk {leg.week} —{" "}
                    <span className="font-semibold text-foreground">
                      {leg.side_name} {formatSpread(Number(leg.spread_for_side))}
                    </span>{" "}
                    vs {leg.opponent_name}
                  </span>
                  <StatusPill status={leg.status} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function MyBetsPage() {
  const managerId = await getCurrentManagerId();

  if (!managerId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">My Bets</h1>
        <p className="text-sm text-muted">Pick your name in the top right to see your bets.</p>
      </div>
    );
  }

  const [bets, parlays, managers] = await Promise.all([
    getManagerBets(managerId),
    getManagerParlays(managerId),
    getManagers(),
  ]);
  const me = managers.find((m) => m.id === managerId);

  const activeBets = bets.filter((b) => b.status !== "cancelled");
  const cancelledBets = bets.filter((b) => b.status === "cancelled");
  const activeParlays = parlays.filter((p) => p.status !== "cancelled");
  const cancelledParlays = parlays.filter((p) => p.status === "cancelled");

  const betsNet = bets
    .filter((b) => b.status !== "pending" && b.status !== "cancelled")
    .reduce((sum, b) => {
      if (b.status === "won") return sum + (Number(b.payout) - Number(b.amount));
      if (b.status === "lost") return sum - Number(b.amount);
      return sum;
    }, 0);
  const parlaysNet = parlays
    .filter((p) => p.status !== "pending" && p.status !== "cancelled")
    .reduce((sum, p) => {
      if (p.status === "won") return sum + (Number(p.payout) - Number(p.amount));
      if (p.status === "lost") return sum - Number(p.amount);
      return sum;
    }, 0);
  const net = betsNet + parlaysNet;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Bets{me ? ` — ${me.display_name}` : ""}</h1>
        <div className="text-right text-sm">
          <div className="text-xs uppercase tracking-wide text-muted">Net (settled)</div>
          <div className={`text-lg font-bold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {net >= 0 ? "+" : ""}
            {net.toFixed(2)}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Straight Bets</h2>
        {activeBets.length === 0 && cancelledBets.length === 0 ? (
          <p className="text-sm text-muted">No straight bets placed yet.</p>
        ) : (
          <>
            {activeBets.length === 0 ? (
              <p className="text-sm text-muted">No active straight bets.</p>
            ) : (
              <BetsTable bets={activeBets} />
            )}
            <CancelledDisclosure count={cancelledBets.length}>
              <BetsTable bets={cancelledBets} />
            </CancelledDisclosure>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parlays</h2>
        {activeParlays.length === 0 && cancelledParlays.length === 0 ? (
          <p className="text-sm text-muted">No parlays placed yet.</p>
        ) : (
          <>
            {activeParlays.length === 0 ? (
              <p className="text-sm text-muted">No active parlays.</p>
            ) : (
              <ParlaysList parlays={activeParlays} />
            )}
            <CancelledDisclosure count={cancelledParlays.length}>
              <ParlaysList parlays={cancelledParlays} />
            </CancelledDisclosure>
          </>
        )}
      </section>
    </div>
  );
}
