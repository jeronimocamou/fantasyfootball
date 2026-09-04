// Pure championship-odds math — no I/O. Blends this year's roster-strength
// ranking (what exists in week 1, before any games are played) with last
// season's final standing, into a single power score per manager, then
// converts that into American odds with a house vig.

export type TeamPower = {
  managerId: number;
  currentRank: number; // ESPN's currentProjectedRank this season (1 = best)
  lastSeasonRank: number | null; // ESPN's rankCalculatedFinal last season, if the manager played
};

export type ChampionshipOdds = {
  managerId: number;
  impliedProbability: number; // this manager's true (no-vig) win probability
  americanOdds: number;
};

// This year is weighted more heavily since it's the more current signal —
// last season reflects last year's different roster/schedule, so it's a
// secondary, recency-weighted input rather than the primary one.
const CURRENT_SEASON_WEIGHT = 0.65;
const LAST_SEASON_WEIGHT = 0.35;

// No manager's longshot price should exceed this — capped for real,
// dynamically, not by clamping outliers down to a flat number (see
// below). A 10-team field where every price stays this tight needs a
// heavy overround, which is what SHRINK_TOWARD_UNIFORM and the solved
// vig below are for.
const MAX_UNDERDOG_ODDS = 550;

// Blends each team's rank-based probability toward a flat 1/N before
// pricing — 1.0 keeps the full spread from the ranks, 0.0 would make
// every team dead even. 0.7 keeps real separation (the leader still
// prices as a real favorite, negative money) while pulling in just
// enough to make MAX_UNDERDOG_ODDS reachable without flattening anyone
// to a single number.
const SHRINK_TOWARD_UNIFORM = 0.7;

// Inverse rank, normalized across the field so it sums to 1 — a team
// ranked 1st contributes far more than one ranked 10th, but every team
// gets a nonzero score (nobody is truly a 0% chance in week 1).
function normalizedInverseRanks(ranks: number[]): number[] {
  const inv = ranks.map((r) => 1 / r);
  const sum = inv.reduce((a, b) => a + b, 0);
  return inv.map((v) => v / sum);
}

export function americanOddsFromProbability(p: number): number {
  if (p <= 0 || p >= 1) throw new Error("Probability must be between 0 and 1");
  if (p >= 0.5) return Math.round((-100 * p) / (1 - p));
  return Math.round((100 * (1 - p)) / p);
}

function probabilityFromAmericanOdds(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

// House-set price overrides, applied after the model runs. The computed
// line for these two priced as heavy favorites (-124 / -116) once the
// +550 field-wide cap forced a heavier vig onto everyone else — the house
// decided that was too short a price to offer on the top two regardless
// of what the model says, and pinned them here instead. Order between the
// two (Michael still shorter than Logan) still matches their model rank.
const MANUAL_ODDS_OVERRIDES: Record<number, number> = {
  1: 155, // Michael Grabel
  4: 190, // logan guerrieri
};

export function computeChampionshipOdds(teams: TeamPower[]): ChampionshipOdds[] {
  if (teams.length === 0) return [];

  const currentRanks = teams.map((t) => t.currentRank);
  const currentScores = normalizedInverseRanks(currentRanks);

  // A manager with no last-season data (new to the league) is treated as
  // a league-average finish, rather than best- or worst-case.
  const averageRank = (teams.length + 1) / 2;
  const lastSeasonRanks = teams.map((t) => t.lastSeasonRank ?? averageRank);
  const lastSeasonScores = normalizedInverseRanks(lastSeasonRanks);

  const composite = teams.map(
    (_, i) => CURRENT_SEASON_WEIGHT * currentScores[i] + LAST_SEASON_WEIGHT * lastSeasonScores[i]
  );
  const compositeSum = composite.reduce((a, b) => a + b, 0);
  const trueProbabilities = composite.map((c) => c / compositeSum);

  // Pull every probability toward 1/N so the field is less extreme, then
  // renormalize back to summing to 1 — order is preserved (whoever ranked
  // ahead still prices shorter), just compressed.
  const n = teams.length;
  const shrunk = trueProbabilities.map((p) => SHRINK_TOWARD_UNIFORM * p + (1 - SHRINK_TOWARD_UNIFORM) * (1 / n));
  const shrunkSum = shrunk.reduce((a, b) => a + b, 0);
  const shrunkProbabilities = shrunk.map((p) => p / shrunkSum);

  // Solve for exactly the vig that puts the field's biggest underdog
  // right at MAX_UNDERDOG_ODDS, rather than hardcoding a vig and hoping
  // it lands under the cap — this way the cap holds every week even as
  // real results reshuffle how spread out the rankings are.
  const minProbabilityNeeded = 100 / (100 + MAX_UNDERDOG_ODDS);
  const minShrunkProbability = Math.min(...shrunkProbabilities);
  const vig = minProbabilityNeeded / minShrunkProbability;

  return teams.map((t, i) => {
    const override = MANUAL_ODDS_OVERRIDES[t.managerId];
    if (override !== undefined) {
      return { managerId: t.managerId, impliedProbability: probabilityFromAmericanOdds(override), americanOdds: override };
    }
    const impliedProbability = trueProbabilities[i];
    const vigProbability = Math.min(0.99, shrunkProbabilities[i] * vig);
    // Rounding to a whole number of American odds can occasionally push a
    // hair past the cap — clamp as a backstop, not the primary mechanism.
    const americanOdds = Math.min(MAX_UNDERDOG_ODDS, americanOddsFromProbability(vigProbability));
    return { managerId: t.managerId, impliedProbability, americanOdds };
  });
}

// Payout for a futures bet, in total dollars returned (stake included) —
// same convention as profitForOdds/parlayPayout in lib/betting.ts.
export function futuresPayout(amount: number, americanOdds: number): number {
  const decimal = americanOdds < 0 ? 1 + 100 / Math.abs(americanOdds) : 1 + americanOdds / 100;
  return Math.round(amount * decimal * 100) / 100;
}
