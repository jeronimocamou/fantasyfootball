"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useParlay } from "./ParlayContext";
import { americanToDecimal } from "@/lib/betting";
import { MIN_BET, MIN_PARLAY_LEGS } from "@/lib/bettingConstants";

export default function ParlaySlip({
  managerId,
  maxAmount,
}: {
  managerId: number | null;
  maxAmount: number;
}) {
  const { legs, removeLeg, clear } = useParlay();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");

  // The success banner is transient: dismiss it on its own after a few
  // seconds. Selecting a new leg clears it immediately too, since that's
  // handled below by requiring legs.length === 0 to show it at all.
  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => setStatus("idle"), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const numericAmount = Number(amount);
  const validAmount = numericAmount > 0 ? numericAmount : 0;
  const combinedDecimal = legs.reduce((acc, l) => acc * americanToDecimal(l.odds), 1);
  const payout = validAmount * combinedDecimal;
  const profit = payout - validAmount;

  async function submit() {
    if (!managerId) {
      setStatus("error");
      setError("Pick your name first.");
      return;
    }
    const value = Number(amount);
    if (!value || value < MIN_BET) {
      setStatus("error");
      setError(`Minimum bet is $${MIN_BET}.`);
      return;
    }
    if (legs.length < MIN_PARLAY_LEGS) {
      setStatus("error");
      setError(`A parlay needs at least ${MIN_PARLAY_LEGS} legs.`);
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/parlays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: value,
        legs: legs.map((l) => ({ lineId: l.lineId, sideManagerId: l.sideManagerId })),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus("error");
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setStatus("done");
    setAmount("");
    clear();
    router.refresh();
  }

  if (status === "done" && legs.length === 0) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-color bg-surface shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12.5l2.5 2.5 5-5" />
            </svg>
            Parlay placed
          </span>
          <button
            onClick={() => router.push("/my-bets")}
            className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            View in My Bets
          </button>
        </div>
      </div>
    );
  }

  if (legs.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-color bg-surface shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            Parlay ({legs.length} leg{legs.length !== 1 ? "s" : ""})
          </span>
          <button onClick={clear} className="text-xs text-muted hover:text-foreground">
            Clear
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {legs.map((l) => (
            <span
              key={l.lineId}
              className="flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs text-accent"
            >
              {l.sideLabel} {l.spreadDisplay}
              <button onClick={() => removeLeg(l.lineId)} className="font-bold hover:opacity-70">
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">$</span>
          <input
            type="number"
            min={MIN_BET}
            max={maxAmount}
            step={1}
            placeholder={String(MIN_BET)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 rounded-md border border-border-color bg-background px-2 py-1 text-sm"
          />
          <button
            onClick={submit}
            disabled={status === "loading" || legs.length < MIN_PARLAY_LEGS}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Place Parlay
          </button>
          {validAmount > 0 && (
            <span className="text-xs text-muted">
              To win <span className="font-medium text-foreground">${profit.toFixed(2)}</span> — pays{" "}
              <span className="font-medium text-foreground">${payout.toFixed(2)}</span> total (
              {combinedDecimal.toFixed(2)}x)
            </span>
          )}
          {legs.length < MIN_PARLAY_LEGS && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Add {MIN_PARLAY_LEGS - legs.length} more leg{MIN_PARLAY_LEGS - legs.length !== 1 ? "s" : ""} to place
            </span>
          )}
          {status === "error" && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}
