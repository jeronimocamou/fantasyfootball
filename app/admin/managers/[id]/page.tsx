import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { getManagers, getManagerBets, getManagerParlays, getManagerSlotHistory } from "@/lib/queries";
import StatusPill from "@/components/StatusPill";

export const dynamic = "force-dynamic";

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ManagerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const managerId = Number(id);
  if (!Number.isInteger(managerId)) notFound();

  const managers = await getManagers();
  const manager = managers.find((m) => m.id === managerId);
  if (!manager) notFound();

  const [bets, parlays, spins] = await Promise.all([
    getManagerBets(managerId),
    getManagerParlays(managerId),
    getManagerSlotHistory(managerId),
  ]);

  const betsNet = bets
    .filter((b) => b.status === "won" || b.status === "lost")
    .reduce((sum, b) => (b.status === "won" ? sum + (Number(b.payout) - Number(b.amount)) : sum - Number(b.amount)), 0);
  const parlaysNet = parlays
    .filter((p) => p.status === "won" || p.status === "lost")
    .reduce((sum, p) => (p.status === "won" ? sum + (Number(p.payout) - Number(p.amount)) : sum - Number(p.amount)), 0);
  const spinsNet = spins.reduce((sum, s) => sum + (Number(s.payout) - Number(s.amount)), 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-foreground">
          ← Back to House Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{manager.display_name}</h1>
        <p className="mt-1 text-sm text-muted">{manager.team_name} — full history across all weeks.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border-color bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Bets net</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${
              betsNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {betsNet >= 0 ? "+$" : "-$"}
            {Math.abs(betsNet).toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-border-color bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">Parlays net</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${
              parlaysNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {parlaysNet >= 0 ? "+$" : "-$"}
            {Math.abs(parlaysNet).toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-border-color bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-muted">🎰 Slots net</div>
          <div
            className={`mt-1 text-lg font-bold tabular-nums ${
              spinsNet >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {spinsNet >= 0 ? "+$" : "-$"}
            {Math.abs(spinsNet).toFixed(2)}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">🎰 Slot Spins ({spins.length})</h2>
        {spins.length === 0 ? (
          <p className="text-sm text-muted">No spins yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Reels</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {spins.map((s) => {
                  const won = Number(s.payout) > 0;
                  return (
                    <tr key={s.id} className="border-t border-border-color/60">
                      <td className="px-4 py-3 text-muted">{formatDate(s.spun_at)}</td>
                      <td className="px-4 py-3 text-muted">Wk {s.week}</td>
                      <td className="px-4 py-3 text-lg tracking-wide">{s.reels.split(",").join(" ")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">${Number(s.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">${Number(s.payout).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <StatusPill status={won ? "won" : "lost"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Straight Bets ({bets.length})</h2>
        {bets.length === 0 ? (
          <p className="text-sm text-muted">No straight bets placed.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
            <table className="w-full min-w-[640px] text-sm">
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
                {bets.map((b) => (
                  <tr key={b.id} className="border-t border-border-color/60">
                    <td className="px-4 py-3 text-muted">Wk {b.week}</td>
                    <td className="px-4 py-3 font-medium">{b.side_name}</td>
                    <td className="px-4 py-3 text-muted">{b.opponent_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">${Number(b.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {b.payout != null ? `$${Number(b.payout).toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parlays ({parlays.length})</h2>
        {parlays.length === 0 ? (
          <p className="text-sm text-muted">No parlays placed.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {parlays.map((p) => (
              <div key={p.id} className="rounded-lg border border-border-color bg-surface p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {p.legs.length}-leg parlay — ${Number(p.amount).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-3">
                    {p.payout != null && <span className="text-xs text-muted">${Number(p.payout).toFixed(2)}</span>}
                    <StatusPill status={p.status} />
                  </div>
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
