import {
  getManagerBets,
  getManagerParlays,
  getManagerFuturesBets,
  getManagers,
  type BetHistoryRow,
  type ParlayHistoryRow,
  type FuturesHistoryRow,
} from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";
import { profitForOdds, parlayPayout } from "@/lib/betting";
import StatusPill from "@/components/StatusPill";
import CancelledDisclosure from "@/components/CancelledDisclosure";
import RiskSummary from "@/components/RiskSummary";

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
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

function FuturesTable({ futures }: { futures: FuturesHistoryRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Pick to win it all</th>
            <th className="px-4 py-3 text-right">Odds</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Status</th>
            <th className="px-4 py-3 text-right">Payout</th>
          </tr>
        </thead>
        <tbody>
          {futures.map((f) => {
            const potentialPayout = Number(f.amount) + profitForOdds(Number(f.amount), f.odds);
            return (
              <tr key={f.id} className="border-t border-border-color/60">
                <td className="px-4 py-3 font-medium">{f.pick_display_name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatOdds(f.odds)}</td>
                <td className="px-4 py-3 text-right tabular-nums">${Number(f.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <StatusPill status={f.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {f.status === "pending" ? (
                    <span className="italic text-muted">${potentialPayout.toFixed(2)} if won</span>
                  ) : f.payout != null ? (
                    `$${Number(f.payout).toFixed(2)}`
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

  const [bets, parlays, futures, managers] = await Promise.all([
    getManagerBets(managerId),
    getManagerParlays(managerId),
    getManagerFuturesBets(managerId),
    getManagers(),
  ]);
  const me = managers.find((m) => m.id === managerId);

  const activeBets = bets.filter((b) => b.status !== "cancelled");
  const cancelledBets = bets.filter((b) => b.status === "cancelled");
  const activeParlays = parlays.filter((p) => p.status !== "cancelled");
  const cancelledParlays = parlays.filter((p) => p.status === "cancelled");
  const activeFutures = futures.filter((f) => f.status !== "cancelled");
  const cancelledFutures = futures.filter((f) => f.status === "cancelled");

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
  const futuresNet = futures
    .filter((f) => f.status !== "pending" && f.status !== "cancelled")
    .reduce((sum, f) => {
      if (f.status === "won") return sum + (Number(f.payout) - Number(f.amount));
      if (f.status === "lost") return sum - Number(f.amount);
      return sum;
    }, 0);
  const net = betsNet + parlaysNet + futuresNet;

  const pendingBets = bets.filter((b) => b.status === "pending");
  const pendingParlays = parlays.filter((p) => p.status === "pending");
  const pendingFutures = futures.filter((f) => f.status === "pending");
  const atRisk =
    pendingBets.reduce((sum, b) => sum + Number(b.amount), 0) +
    pendingParlays.reduce((sum, p) => sum + Number(p.amount), 0) +
    pendingFutures.reduce((sum, f) => sum + Number(f.amount), 0);
  const toWin =
    pendingBets.reduce((sum, b) => sum + profitForOdds(Number(b.amount), b.odds), 0) +
    pendingFutures.reduce((sum, f) => sum + profitForOdds(Number(f.amount), f.odds), 0) +
    pendingParlays.reduce((sum, p) => {
      const payout = parlayPayout(
        Number(p.amount),
        p.legs.filter((l) => l.status !== "lost").map((l) => l.odds)
      );
      return sum + (payout != null ? payout - Number(p.amount) : 0);
    }, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Bets{me ? ` — ${me.display_name}` : ""}</h1>
        <div className="text-right text-sm">
          <div className="text-xs uppercase tracking-wide text-muted">Net (settled)</div>
          <div className={`text-lg font-bold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {net >= 0 ? "+$" : "-$"}
            {Math.abs(net).toFixed(2)}
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">Futures</h2>
        {activeFutures.length === 0 && cancelledFutures.length === 0 ? (
          <p className="text-sm text-muted">No futures bets placed yet.</p>
        ) : (
          <>
            {activeFutures.length === 0 ? (
              <p className="text-sm text-muted">No active futures bets.</p>
            ) : (
              <FuturesTable futures={activeFutures} />
            )}
            <CancelledDisclosure count={cancelledFutures.length}>
              <FuturesTable futures={cancelledFutures} />
            </CancelledDisclosure>
          </>
        )}
      </section>

      <RiskSummary atRisk={atRisk} toWin={toWin} />
    </div>
  );
}
