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

// Grades a bet on team A's side of a line with spreadA relative to team A.
// actualA/actualB are the final scores. Standard against-the-spread logic:
// margin (A - B) plus A's spread > 0 means A covered.
export function gradeSide(
  actualA: number,
  actualB: number,
  spreadA: number,
  side: "a" | "b"
): BetOutcome {
  const adjustedMarginA = actualA - actualB + spreadA;
  if (adjustedMarginA === 0) return "push";
  const aCovers = adjustedMarginA > 0;
  if (side === "a") return aCovers ? "won" : "lost";
  return aCovers ? "lost" : "won";
}
