"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagerWeekSummary, AdminBetRow, AdminParlayRow } from "@/lib/queries";
import StatusPill from "@/components/StatusPill";
import CancelledDisclosure from "@/components/CancelledDisclosure";

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
}

function BetsTable({ bets, onCancel }: { bets: AdminBetRow[]; onCancel: (betId: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Bettor</th>
            <th className="px-4 py-3">Pick</th>
            <th className="px-4 py-3">Vs</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {bets.map((b) => (
            <tr key={b.id} className="border-t border-border-color/60">
              <td className="px-4 py-3">{b.manager_name}</td>
              <td className="px-4 py-3 font-medium">
                {b.side_name} {formatSpread(Number(b.spread_for_side))}
              </td>
              <td className="px-4 py-3 text-muted">{b.opponent_name}</td>
              <td className="px-4 py-3 text-right tabular-nums">${Number(b.amount).toFixed(2)}</td>
              <td className="px-4 py-3 text-right">
                <StatusPill status={b.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {b.status === "pending" && (
                  <button
                    onClick={() => onCancel(b.id)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParlaysList({ parlays, onCancel }: { parlays: AdminParlayRow[]; onCancel: (parlayId: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {parlays.map((p) => (
        <div key={p.id} className="rounded-lg border border-border-color bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {p.manager_name} — {p.legs.length}-leg parlay — ${Number(p.amount).toFixed(2)}
            </span>
            <div className="flex items-center gap-3">
              {p.payout != null && <span className="text-xs text-muted">${Number(p.payout).toFixed(2)}</span>}
              <StatusPill status={p.status} />
              {p.status === "pending" && (
                <button
                  onClick={() => onCancel(p.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {p.legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted">
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
  );
}

export default function AdminDashboard({
  season,
  week,
  managers,
  bets,
  parlays,
}: {
  season: number;
  week: number;
  managers: ManagerWeekSummary[];
  bets: AdminBetRow[];
  parlays: AdminParlayRow[];
}) {
  const router = useRouter();

  const activeBets = bets.filter((b) => b.status !== "cancelled");
  const cancelledBets = bets.filter((b) => b.status === "cancelled");
  const activeParlays = parlays.filter((p) => p.status !== "cancelled");
  const cancelledParlays = parlays.filter((p) => p.status === "cancelled");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function cancelBet(betId: number) {
    if (!confirm("Cancel this bet? This can't be undone.")) return;
    await fetch("/api/admin/cancel-bet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ betId }),
    });
    router.refresh();
  }

  async function cancelParlay(parlayId: number) {
    if (!confirm("Cancel this parlay? This can't be undone.")) return;
    await fetch("/api/admin/cancel-parlay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parlayId }),
    });
    router.refresh();
  }

  async function resetPin(managerId: number, name: string) {
    if (!confirm(`Reset ${name}'s PIN? They'll need to set a new one next time they log in.`)) return;
    await fetch("/api/admin/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">House Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Week {week} — everyone&apos;s bets and balances.</p>
        </div>
        <button onClick={logout} className="text-sm text-muted hover:text-foreground">
          Log out
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Manager Balances</h2>
        <div className="overflow-x-auto rounded-lg border border-border-color bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-foreground/5 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3 text-right">Spent</th>
                <th className="px-4 py-3 text-right">Adjustment</th>
                <th className="px-4 py-3 text-right">Allowance</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3">Adjust</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <ManagerRow
                  key={m.manager_id}
                  manager={m}
                  season={season}
                  week={week}
                  onDone={() => router.refresh()}
                  onResetPin={() => resetPin(m.manager_id, m.display_name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Straight Bets</h2>
        {activeBets.length === 0 && cancelledBets.length === 0 ? (
          <p className="text-sm text-muted">No bets this week.</p>
        ) : (
          <>
            {activeBets.length === 0 ? (
              <p className="text-sm text-muted">No active bets this week.</p>
            ) : (
              <BetsTable bets={activeBets} onCancel={cancelBet} />
            )}
            <CancelledDisclosure count={cancelledBets.length}>
              <BetsTable bets={cancelledBets} onCancel={cancelBet} />
            </CancelledDisclosure>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parlays</h2>
        {activeParlays.length === 0 && cancelledParlays.length === 0 ? (
          <p className="text-sm text-muted">No parlays this week.</p>
        ) : (
          <>
            {activeParlays.length === 0 ? (
              <p className="text-sm text-muted">No active parlays this week.</p>
            ) : (
              <ParlaysList parlays={activeParlays} onCancel={cancelParlay} />
            )}
            <CancelledDisclosure count={cancelledParlays.length}>
              <ParlaysList parlays={cancelledParlays} onCancel={cancelParlay} />
            </CancelledDisclosure>
          </>
        )}
      </section>
    </div>
  );
}

function ManagerRow({
  manager,
  season,
  week,
  onDone,
  onResetPin,
}: {
  manager: ManagerWeekSummary;
  season: number;
  week: number;
  onDone: () => void;
  onResetPin: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    const value = Number(amount);
    if (!value) return;
    setLoading(true);
    await fetch("/api/admin/adjust-balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: manager.manager_id, season, week, amount: value, note }),
    });
    setAmount("");
    setNote("");
    setLoading(false);
    onDone();
  }

  return (
    <tr className="border-t border-border-color/60">
      <td className="px-4 py-3 font-medium">{manager.display_name}</td>
      <td className="px-4 py-3 text-right tabular-nums">${manager.spent.toFixed(2)}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {manager.adjustment >= 0 ? "+" : ""}
        {manager.adjustment.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">${manager.allowance.toFixed(2)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold">${manager.remaining.toFixed(2)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step={1}
            placeholder="+/-"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-16 rounded-md border border-border-color bg-background px-1.5 py-1 text-xs"
          />
          <input
            type="text"
            placeholder="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-24 rounded-md border border-border-color bg-background px-1.5 py-1 text-xs"
          />
          <button
            onClick={submit}
            disabled={!amount || loading}
            className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </td>
      <td className="px-4 py-3">
        <button onClick={onResetPin} className="text-xs text-muted hover:text-red-600 dark:hover:text-red-400">
          Reset PIN
        </button>
      </td>
    </tr>
  );
}
