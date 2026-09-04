// Pure slot-machine math — no I/O, no randomness source baked in, so the
// odds are easy to reason about and the RNG can be swapped/tested.

// Pulls are picked in 50-cent tokens, from one token up to six.
export const SLOT_MIN_BET = 0.5;
export const SLOT_MAX_BET = 3;
export const SLOT_BET_STEP = 0.5;

// True only for amounts landing exactly on a 50-cent step within range —
// the server never trusts a client-supplied amount without this check.
export function isValidSlotBet(amount: number): boolean {
  if (!Number.isFinite(amount)) return false;
  if (amount < SLOT_MIN_BET - 1e-9 || amount > SLOT_MAX_BET + 1e-9) return false;
  const steps = Math.round(amount / SLOT_BET_STEP);
  return Math.abs(steps * SLOT_BET_STEP - amount) < 1e-9;
}

export type SlotSymbol = "cherry" | "lemon" | "bell" | "seven";

export const SLOT_EMOJI: Record<SlotSymbol, string> = {
  cherry: "🍒",
  lemon: "🍋",
  bell: "🔔",
  seven: "7️⃣",
};

// Weights out of 100 — how often each symbol lands on a single reel.
const SLOT_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: "cherry", weight: 40 },
  { symbol: "lemon", weight: 30 },
  { symbol: "bell", weight: 20 },
  { symbol: "seven", weight: 10 },
];

// Payout multiplier for three of a kind. Two matching (any pair among the
// three reels) pays half the stake back; anything else loses it all.
// Landing on these weights, that works out to exactly an 85%
// return-to-player rate:
//   0.4^3*4 + 0.3^3*6 + 0.2^3*12 + 0.1^3*36 + 0.6*0.5 = 0.85
// Jackpot (seven/seven/seven) odds: (10/100)^3 = 1 in 1,000 spins.
export const THREE_OF_A_KIND_PAYOUT: Record<SlotSymbol, number> = {
  cherry: 4,
  lemon: 6,
  bell: 12,
  seven: 36,
};

export const TWO_OF_A_KIND_PAYOUT_FRACTION = 0.5;

// Display order for the paytable popout — cheapest to jackpot.
export const SLOT_SYMBOL_ORDER: SlotSymbol[] = ["cherry", "lemon", "bell", "seven"];

export function spinReel(random: () => number = Math.random): SlotSymbol {
  const roll = random() * 100;
  let cumulative = 0;
  for (const { symbol, weight } of SLOT_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return symbol;
  }
  return SLOT_WEIGHTS[SLOT_WEIGHTS.length - 1].symbol;
}

export function spinReels(random: () => number = Math.random): [SlotSymbol, SlotSymbol, SlotSymbol] {
  return [spinReel(random), spinReel(random), spinReel(random)];
}

// Payout for a spin, in total dollars returned (stake included) — same
// convention as profitForOdds/parlayPayout in lib/betting.ts.
export function gradeSpin(reels: [SlotSymbol, SlotSymbol, SlotSymbol], amount: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return Math.round(amount * THREE_OF_A_KIND_PAYOUT[a] * 100) / 100;
  }
  if (a === b || b === c || a === c) {
    return Math.round(amount * TWO_OF_A_KIND_PAYOUT_FRACTION * 100) / 100;
  }
  return 0;
}
