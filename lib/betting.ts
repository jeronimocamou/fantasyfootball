// Pure betting math — no I/O, so this is easy to reason about and test.

export type Line = {
  projA: number;
  projB: number;
  spreadA: number; // relative to team A: negative = A favored, positive = A underdog
};

// Spread is just the raw projected-point gap. Team B's number is always -spreadA.
export function computeLine(projA: number, projB: number): Line {
  const spreadA = Math.round((projB - projA) * 10) / 10;
  return { projA, projB, spreadA };
}

export const DEFAULT_ODDS = -110;

// American odds -> profit on a winning bet (excludes the returned stake).
export function profitForOdds(amount: number, odds: number): number {
  const profit = odds < 0 ? (amount * 100) / Math.abs(odds) : (amount * odds) / 100;
  return Math.round(profit * 100) / 100;
}

export type BetOutcome = "won" | "lost" | "push";

// American -> decimal odds (the multiplier applied to stake for a win,
// stake included). -110 -> ~1.909, +150 -> 2.5, etc.
export function americanToDecimal(odds: number): number {
  return odds < 0 ? 1 + 100 / Math.abs(odds) : 1 + odds / 100;
}

// Parlay payout: decimal odds multiply together across every leg that
// didn't push (a push leg is dropped — standard sportsbook treatment,
// the parlay just becomes one leg shorter rather than voiding entirely).
// Returns null if every leg pushed (the whole parlay pushes, stake back).
export function parlayPayout(stake: number, legOdds: number[]): number | null {
  if (legOdds.length === 0) return null;
  const combinedDecimal = legOdds.reduce((acc, odds) => acc * americanToDecimal(odds), 1);
  return Math.round(stake * combinedDecimal * 100) / 100;
}

// Grades a bet on team A's side of a line with spreadA relative to team A.
// actualA/actualB are the final scores. Standard against-the-spread logic:
// margin (A - B) plus A's spread > 0 means A covered.
export function gradeSide(
  actualA: number,
  actualB: number,
  spreadA: number,
  side: "a" | "b"
): BetOutcome {
  // Round before comparing to zero — floating point makes exact-push
  // arithmetic like 100.0 - 100.2 + 0.2 land a hair off zero (e.g.
  // -2.8e-15) instead of exactly 0, which would otherwise misgrade a
  // real push as a win or loss. Scores/spreads never carry more than 2
  // decimal places, so rounding to that precision is safe.
  const adjustedMarginA = Math.round((actualA - actualB + spreadA) * 100) / 100;
  if (adjustedMarginA === 0) return "push";
  const aCovers = adjustedMarginA > 0;
  if (side === "a") return aCovers ? "won" : "lost";
  return aCovers ? "lost" : "won";
}
