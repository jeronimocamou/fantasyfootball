"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BetForm({
  managerId,
  lineId,
  sideManagerId,
  sideLabel,
  maxAmount,
}: {
  managerId: number;
  lineId: number;
  sideManagerId: number;
  sideLabel: string;
  maxAmount: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setStatus("error");
      setError("Enter an amount.");
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId, lineId, sideManagerId, amount: value }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setStatus("error");
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setStatus("done");
    setAmount("");
    router.refresh();
  }

  if (status === "done") {
    return <p className="text-xs text-emerald-600 dark:text-emerald-400">Bet placed on {sideLabel}.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">$</span>
      <input
        type="number"
        min={1}
        max={maxAmount}
        step={1}
        placeholder="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-16 rounded-md border border-border-color bg-surface px-2 py-1 text-sm"
      />
      <button
        onClick={submit}
        disabled={status === "loading"}
        className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
      >
        Bet {sideLabel}
      </button>
      {status === "error" && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
