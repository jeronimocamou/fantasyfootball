// Pure slot-machine math — no I/O, no randomness source baked in, so the
// odds are easy to reason about and the RNG can be swapped/tested.

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
// three reels) always pushes — stake back, no profit. Everything else
// loses the stake. Landing on these weights, that works out to roughly an
// 87% return-to-player rate: generous enough to feel fun, low enough that
// it can't be farmed as free credit for the real board.
const THREE_OF_A_KIND_PAYOUT: Record<SlotSymbol, number> = {
  cherry: 2,
  lemon: 3,
  bell: 6,
  seven: 15,
};

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
    return amount; // push
  }
  return 0;
}
