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
// Seven is deliberately rare — 8% per reel puts the jackpot at 1 in
// 1,953, the closest whole-number weight gets to a 1-in-2,000 target.
const SLOT_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: "cherry", weight: 41 },
  { symbol: "lemon", weight: 31 },
  { symbol: "bell", weight: 20 },
  { symbol: "seven", weight: 8 },
];

// Payout multiplier for three of a kind — the only thing that pays.
// Anything else (including two matching) loses the stake, same as a real
// 3-reel machine: only the full line wins. Deliberately capped rather
// than solved for a specific RTP target — a $3 max bet already turns
// into a $150 jackpot at 50x, which is plenty dramatic without one pull
// dwarfing a week's whole credit pool. Works out to a 73.65% RTP:
//   0.41^3*5 + 0.31^3*8 + 0.2^3*16 + 0.08^3*50 = 0.7365
// Jackpot (seven/seven/seven) odds: (8/100)^3 = 1 in 1,953 spins.
export const THREE_OF_A_KIND_PAYOUT: Record<SlotSymbol, number> = {
  cherry: 5,
  lemon: 8,
  bell: 16,
  seven: 50,
};

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
// convention as profitForOdds/parlayPayout in lib/betting.ts. Only three
// of a kind pays; anything else, including two matching, loses the stake.
export function gradeSpin(reels: [SlotSymbol, SlotSymbol, SlotSymbol], amount: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return Math.round(amount * THREE_OF_A_KIND_PAYOUT[a] * 100) / 100;
  }
  return 0;
}
