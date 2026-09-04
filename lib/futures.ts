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

// Futures carry a heavier overround than a single game line — a 20-30%
// total vig on a 10-way market is standard for a long-shot futures book,
// versus ~5% on a two-way spread.
const FUTURES_VIG = 1.25;

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

  return teams.map((t, i) => {
    const impliedProbability = trueProbabilities[i];
    const vigProbability = Math.min(0.99, impliedProbability * FUTURES_VIG);
    return {
      managerId: t.managerId,
      impliedProbability,
      americanOdds: americanOddsFromProbability(vigProbability),
    };
  });
}

// Payout for a futures bet, in total dollars returned (stake included) —
// same convention as profitForOdds/parlayPayout in lib/betting.ts.
export function futuresPayout(amount: number, americanOdds: number): number {
  const decimal = americanOdds < 0 ? 1 + 100 / Math.abs(americanOdds) : 1 + americanOdds / 100;
  return Math.round(amount * decimal * 100) / 100;
}
