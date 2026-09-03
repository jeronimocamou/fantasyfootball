"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagerWeekSummary, AdminBetRow, AdminParlayRow } from "@/lib/queries";

const STATUS_STYLE: Record<string, string> = {
  pending: "text-muted",
  won: "text-emerald-600 dark:text-emerald-400",
  lost: "text-red-600 dark:text-red-400",
  push: "text-muted",
  cancelled: "text-muted line-through",
};

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
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
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <ManagerRow key={m.manager_id} manager={m} season={season} week={week} onDone={() => router.refresh()} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Straight Bets</h2>
        {bets.length === 0 ? (
          <p className="text-sm text-muted">No bets this week.</p>
        ) : (
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
                    <td className={`px-4 py-3 text-right capitalize ${STATUS_STYLE[b.status]}`}>{b.status}</td>
                    <td className="px-4 py-3 text-right">
                      {b.status === "pending" && (
                        <button
                          onClick={() => cancelBet(b.id)}
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
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Parlays</h2>
        {parlays.length === 0 ? (
          <p className="text-sm text-muted">No parlays this week.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {parlays.map((p) => (
              <div key={p.id} className="rounded-lg border border-border-color bg-surface p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {p.manager_name} — {p.legs.length}-leg parlay — ${Number(p.amount).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`capitalize ${STATUS_STYLE[p.status]}`}>
                      {p.status}
                      {p.payout != null && ` — $${Number(p.payout).toFixed(2)}`}
                    </span>
                    {p.status === "pending" && (
                      <button
                        onClick={() => cancelParlay(p.id)}
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
                      <span className={`capitalize ${STATUS_STYLE[leg.status]}`}>{leg.status}</span>
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

function ManagerRow({
  manager,
  season,
  week,
  onDone,
}: {
  manager: ManagerWeekSummary;
  season: number;
  week: number;
  onDone: () => void;
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
    </tr>
  );
}
