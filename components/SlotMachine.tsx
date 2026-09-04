"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_EMOJI, SLOT_BET_AMOUNT } from "@/lib/slots";

const REEL_SYMBOLS = Object.values(SLOT_EMOJI);
const SPIN_MS = 2200; // all three reels blur before any of them stop
const STOP_STAGGER_MS = 500; // gap between each reel locking in, left to right
const TICK_MS = 90;

function randomSymbol() {
  return REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Outcome = "won" | "half" | "lost";

export default function SlotMachine({ initialCredit }: { initialCredit: number }) {
  const router = useRouter();
  const [credit, setCredit] = useState(initialCredit);
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [outcome, setOutcome] = useState<{ result: Outcome; payout: number } | null>(null);
  const [error, setError] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedRef = useRef([false, false, false]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function spin() {
    if (spinning) return;
    if (SLOT_BET_AMOUNT > credit + 1e-9) {
      setError(`Only $${credit.toFixed(2)} of credit left this week.`);
      return;
    }

    setError("");
    setOutcome(null);
    setSpinning(true);
    setLeverPulled(true);
    setTimeout(() => setLeverPulled(false), 300);

    lockedRef.current = [false, false, false];
    tickRef.current = setInterval(() => {
      setReels((prev) => prev.map((sym, i) => (lockedRef.current[i] ? sym : randomSymbol())));
    }, TICK_MS);

    const [res] = await Promise.all([
      fetch("/api/slots", { method: "POST" }),
      wait(SPIN_MS),
    ]);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      if (tickRef.current) clearInterval(tickRef.current);
      setSpinning(false);
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const symbols = data.reels as string[];
    const emojiReels = symbols.map((s) => SLOT_EMOJI[s as keyof typeof SLOT_EMOJI]);

    // Lock reels one at a time, left to right, for a proper old-school
    // clunk-clunk-clunk stop instead of all three landing at once.
    for (let i = 0; i < 3; i++) {
      if (i > 0) await wait(STOP_STAGGER_MS);
      lockedRef.current[i] = true;
      setReels((prev) => {
        const next = [...prev];
        next[i] = emojiReels[i];
        return next;
      });
    }

    if (tickRef.current) clearInterval(tickRef.current);
    setSpinning(false);
    setCredit(data.credit);
    const [a, b, c] = symbols;
    const result: Outcome = a === b && b === c ? "won" : a === b || b === c || a === c ? "half" : "lost";
    setOutcome({ result, payout: data.payout });
    router.refresh();
  }

  return (
    <div className="relative w-full max-w-sm">
      {/* pull lever */}
      <button
        onClick={spin}
        disabled={spinning || credit < SLOT_BET_AMOUNT}
        aria-label="Pull lever"
        className="absolute -right-5 top-10 z-10 flex flex-col items-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span
          className={`h-6 w-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-md transition-transform duration-300 ${
            leverPulled ? "translate-y-16" : ""
          }`}
        />
        <span
          className={`w-1.5 flex-1 bg-gradient-to-b from-[#8a6a2f] to-[#5c4620] transition-all duration-300 ${
            leverPulled ? "h-10" : "h-24"
          }`}
        />
      </button>

      {/* cabinet body */}
      <div className="rounded-t-[70px] rounded-b-2xl border-4 border-[#5c4620] bg-gradient-to-b from-[#4a3820] to-[#221808] px-5 pb-5 pt-6 shadow-2xl">
        {/* marquee */}
        <div className="mb-3 flex items-center justify-center gap-1.5 rounded-full bg-[#1a1208] px-3 py-1.5">
          {["#e0b84a", "#e0b84a", "#e0b84a", "#e0b84a", "#e0b84a"].map((c, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="mb-3 text-center font-display text-xs font-bold tracking-[0.3em] text-[#e0b84a]">
          CRACKYARD
        </div>

        <div className="flex items-center justify-between rounded-lg bg-[#1a1208] px-3 py-2 text-xs">
          <span className="uppercase tracking-wide text-[#a89b85]">Credit</span>
          <span className="font-display text-base font-semibold text-[#e0b84a]">${credit.toFixed(2)}</span>
        </div>

        <div className="mt-3 flex justify-center gap-2 rounded-xl border-4 border-[#5c4620] bg-[#0f0a05] p-4">
          {reels.map((symbol, i) => (
            <div
              key={i}
              className="flex h-20 w-20 items-center justify-center rounded-md bg-[#1a130a] text-4xl shadow-inner"
            >
              {symbol}
            </div>
          ))}
        </div>

        <div className="mt-3 flex h-6 items-center justify-center text-center text-sm">
          {outcome?.result === "won" && (
            <span className="font-semibold text-emerald-400">🎉 Won ${outcome.payout.toFixed(2)}!</span>
          )}
          {outcome?.result === "half" && (
            <span className="text-amber-300">Two matching — ${outcome.payout.toFixed(2)} back.</span>
          )}
          {outcome?.result === "lost" && <span className="text-red-400">No match. House wins.</span>}
          {error && <span className="text-red-400">{error}</span>}
        </div>

        <div className="mt-3 flex justify-center">
          <button
            onClick={spin}
            disabled={spinning || credit < SLOT_BET_AMOUNT}
            className="rounded-full bg-[#e0b84a] px-8 py-2.5 text-sm font-semibold text-[#221808] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {spinning ? "Spinning…" : `Pull — $${SLOT_BET_AMOUNT}`}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#a89b85]">
          Three of a kind pays out — 7️⃣7️⃣7️⃣ is the jackpot (15x). Two matching pays
          half back. No match loses the spin.
        </p>
      </div>

      {/* base */}
      <div className="mx-auto h-3 w-4/5 rounded-b-lg bg-[#150f06]" />
    </div>
  );
}
