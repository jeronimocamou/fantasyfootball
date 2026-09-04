"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_BET } from "@/lib/bettingConstants";
import { SLOT_EMOJI } from "@/lib/slots";

const REEL_SYMBOLS = Object.values(SLOT_EMOJI);
const SPIN_MS = 900;
const TICK_MS = 80;

function randomSymbol() {
  return REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
}

type Outcome = "won" | "push" | "lost";

export default function SlotMachine({ initialCredit }: { initialCredit: number }) {
  const router = useRouter();
  const [credit, setCredit] = useState(initialCredit);
  const [amount, setAmount] = useState(String(MIN_BET));
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<{ result: Outcome; payout: number } | null>(null);
  const [error, setError] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function spin() {
    const value = Number(amount);
    if (!value || value < MIN_BET) {
      setError(`Minimum spin is $${MIN_BET}.`);
      return;
    }
    if (value > credit + 1e-9) {
      setError(`Only $${credit.toFixed(2)} of credit left this week.`);
      return;
    }

    setError("");
    setOutcome(null);
    setSpinning(true);
    tickRef.current = setInterval(() => {
      setReels([randomSymbol(), randomSymbol(), randomSymbol()]);
    }, TICK_MS);

    const [res] = await Promise.all([
      fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      }),
      new Promise((resolve) => setTimeout(resolve, SPIN_MS)),
    ]);

    if (tickRef.current) clearInterval(tickRef.current);
    setSpinning(false);

    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const emojiReels = (data.reels as string[]).map((s) => SLOT_EMOJI[s as keyof typeof SLOT_EMOJI]);
    setReels(emojiReels);
    setCredit(data.credit);
    const result: Outcome = data.payout > value ? "won" : data.payout === value ? "push" : "lost";
    setOutcome({ result, payout: data.payout });
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border-color bg-[#241b10] p-5 shadow-lg dark:bg-[#120d08]">
      <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-xs">
        <span className="uppercase tracking-wide text-muted">Credit</span>
        <span className="font-display text-base font-semibold text-accent">${credit.toFixed(2)}</span>
      </div>

      <div className="mt-4 flex justify-center gap-2 rounded-xl border-4 border-[#3a2b17] bg-[#0f0a05] p-4">
        {reels.map((symbol, i) => (
          <div
            key={i}
            className="flex h-20 w-20 items-center justify-center rounded-md bg-[#1a130a] text-4xl shadow-inner"
          >
            {symbol}
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-6 items-center justify-center text-center text-sm">
        {outcome?.result === "won" && (
          <span className="font-semibold text-emerald-400">🎉 Won ${outcome.payout.toFixed(2)}!</span>
        )}
        {outcome?.result === "push" && (
          <span className="text-amber-300">Push — stake back.</span>
        )}
        {outcome?.result === "lost" && <span className="text-red-400">No match. House wins.</span>}
        {error && <span className="text-red-400">{error}</span>}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <span className="text-sm text-[#d8cbb6]">$</span>
        <input
          type="number"
          min={MIN_BET}
          max={credit}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={spinning}
          className="w-20 rounded-md border border-[#3a2b17] bg-[#1a130a] px-2 py-1.5 text-center text-sm text-[#f0ebdd] disabled:opacity-50"
        />
        <button
          onClick={spin}
          disabled={spinning || credit < MIN_BET}
          className="rounded-full bg-accent px-6 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {spinning ? "Spinning…" : "Pull"}
        </button>
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#a89b85]">
        Three of a kind pays out — 7️⃣7️⃣7️⃣ is the jackpot (15x). Two matching pushes.
        No match loses the spin.
      </p>
    </div>
  );
}
