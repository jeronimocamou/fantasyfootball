"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SLOT_EMOJI,
  SLOT_MIN_BET,
  SLOT_MAX_BET,
  SLOT_BET_STEP,
  SLOT_SYMBOL_ORDER,
  THREE_OF_A_KIND_PAYOUT,
  TWO_OF_A_KIND_PAYOUT_FRACTION,
} from "@/lib/slots";

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

function clampBet(amount: number): number {
  const stepped = Math.round(amount / SLOT_BET_STEP) * SLOT_BET_STEP;
  return Math.min(SLOT_MAX_BET, Math.max(SLOT_MIN_BET, Math.round(stepped * 100) / 100));
}

type Outcome = "won" | "half" | "lost";

export default function SlotMachine({
  initialCredit,
  initialBalance,
}: {
  initialCredit: number;
  initialBalance: number;
}) {
  const router = useRouter();
  const [credit, setCredit] = useState(initialCredit);
  const [balance, setBalance] = useState(initialBalance);
  const [amount, setAmount] = useState(SLOT_MIN_BET);
  const [reels, setReels] = useState<string[]>(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [outcome, setOutcome] = useState<{ result: Outcome; payout: number } | null>(null);
  const [error, setError] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockedRef = useRef([false, false, false]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const canSpin = !spinning && !showPaytable && amount <= credit + 1e-9;

  async function spin() {
    if (spinning || showPaytable) return;
    if (amount > credit + 1e-9) {
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
      fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      }),
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
    setBalance(data.balance);
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
        disabled={!canSpin}
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

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col items-center rounded-lg bg-[#1a1208] px-3 py-2 text-xs">
            <span className="uppercase tracking-wide text-[#a89b85]">Credit</span>
            <span className="font-display text-base font-semibold text-[#e0b84a]">${credit.toFixed(2)}</span>
          </div>
          <div className="flex flex-1 flex-col items-center rounded-lg bg-[#1a1208] px-3 py-2 text-xs">
            <span className="uppercase tracking-wide text-[#a89b85]">Balance</span>
            <span
              className={`font-display text-base font-semibold ${
                balance >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {balance >= 0 ? "+$" : "-$"}
              {Math.abs(balance).toFixed(2)}
            </span>
          </div>
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

        {/* bet amount stepper */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setAmount((a) => clampBet(a - SLOT_BET_STEP))}
            disabled={spinning || amount <= SLOT_MIN_BET + 1e-9}
            aria-label="Decrease pull amount"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e0b84a]/60 text-sm font-bold text-[#e0b84a] transition-colors hover:bg-[#e0b84a]/10 disabled:opacity-30"
          >
            −
          </button>
          <span className="w-16 text-center font-display text-sm font-semibold text-[#cfc2a8]">
            ${amount.toFixed(2)} / pull
          </span>
          <button
            onClick={() => setAmount((a) => clampBet(a + SLOT_BET_STEP))}
            disabled={spinning || amount >= SLOT_MAX_BET - 1e-9}
            aria-label="Increase pull amount"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e0b84a]/60 text-sm font-bold text-[#e0b84a] transition-colors hover:bg-[#e0b84a]/10 disabled:opacity-30"
          >
            +
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={spin}
            disabled={!canSpin}
            className="rounded-full bg-[#e0b84a] px-8 py-2.5 text-sm font-semibold text-[#221808] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {spinning ? "Spinning…" : `Pull — $${amount.toFixed(2)}`}
          </button>
          <button
            onClick={() => setShowPaytable((v) => !v)}
            className="rounded-full border border-[#e0b84a]/60 px-4 py-2.5 text-xs font-semibold text-[#e0b84a] transition-colors hover:bg-[#e0b84a]/10"
          >
            Payouts
          </button>
        </div>
      </div>

      {/* base */}
      <div className="mx-auto h-3 w-4/5 rounded-b-lg bg-[#150f06]" />

      {/* paytable popout — sized to fully cover the lever so it can't be
          bumped by accident while this is open (the lever button is also
          disabled above, as a second guard). */}
      {showPaytable && (
        <div className="absolute left-2 right-[-44px] top-4 bottom-4 z-20 overflow-y-auto rounded-2xl border-2 border-[#e0b84a] bg-[#140d05] p-5 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-base font-bold tracking-[0.15em] text-[#e0b84a]">PAYTABLE</span>
            <button
              onClick={() => setShowPaytable(false)}
              aria-label="Close paytable"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#a89b85] hover:bg-white/10 hover:text-[#e0b84a]"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#3a2b17]">
            {SLOT_SYMBOL_ORDER.map((symbol) => (
              <div key={symbol} className="flex items-center justify-between py-2.5">
                <span className="text-2xl">
                  {SLOT_EMOJI[symbol]}
                  {SLOT_EMOJI[symbol]}
                  {SLOT_EMOJI[symbol]}
                </span>
                <span className="flex items-center gap-2">
                  {symbol === "seven" && (
                    <span className="rounded-full bg-[#e0b84a] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#221808]">
                      JACKPOT
                    </span>
                  )}
                  <span className="font-display text-base font-semibold text-[#e0b84a]">
                    {THREE_OF_A_KIND_PAYOUT[symbol]}×
                  </span>
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#cfc2a8]">Any two matching</span>
              <span className="font-display text-base font-semibold text-[#e0b84a]">
                {TWO_OF_A_KIND_PAYOUT_FRACTION}× back
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#cfc2a8]">No match</span>
              <span className="font-display text-base font-semibold text-red-400">Lose stake</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-[#a89b85]">
            Pulls run ${SLOT_MIN_BET.toFixed(2)}–${SLOT_MAX_BET.toFixed(2)} in {SLOT_BET_STEP.toFixed(2)} steps.
          </p>
        </div>
      )}
    </div>
  );
}
