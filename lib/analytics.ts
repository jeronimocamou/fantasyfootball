import { getDb } from "./db";

export type WeeklyScoreRow = {
  season: number;
  week: number;
  team_id: number;
  member_id: string | null;
  display_name: string;
  score: number;
};

export function getAllWeeklyScores(): WeeklyScoreRow[] {
  return getDb()
    .prepare(
      `SELECT sc.season, sc.week, sc.team_id, t.primary_owner AS member_id,
              COALESCE(m.display_name, 'Unknown') AS display_name, sc.score
       FROM (
         SELECT season, week, home_team_id AS team_id, home_score AS score FROM matchups WHERE home_score + away_score > 0
         UNION ALL
         SELECT season, week, away_team_id AS team_id, away_score AS score FROM matchups WHERE home_score + away_score > 0
       ) sc
       JOIN teams t ON t.season = sc.season AND t.team_id = sc.team_id
       LEFT JOIN members m ON t.primary_owner = m.member_id`
    )
    .all() as WeeklyScoreRow[];
}

// "Luck": each week, a team's expected win fraction is the share of the
// league they outscored that week (ties split 50/50). Summed across a
// manager's career and compared to their actual win total. A positive
// luck score means they've won more than their weekly scores alone would
// predict (favorable schedule); negative means the opposite.
export type LuckRow = {
  member_id: string;
  display_name: string;
  games: number;
  actual_wins: number;
  expected_wins: number;
  luck: number;
};

export function getLuckIndex(): LuckRow[] {
  const rows = getAllWeeklyScores();
  const byWeek = new Map<string, WeeklyScoreRow[]>();
  for (const r of rows) {
    const key = `${r.season}-${r.week}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(r);
  }

  const expected = new Map<string, { display_name: string; expected: number }>();
  for (const group of byWeek.values()) {
    const n = group.length;
    if (n < 2) continue;
    for (const team of group) {
      const lower = group.filter((g) => g.score < team.score).length;
      const equal = group.filter((g) => g.score === team.score).length - 1;
      const winFrac = (lower + equal * 0.5) / (n - 1);
      const key = team.member_id ?? team.display_name;
      if (!expected.has(key)) expected.set(key, { display_name: team.display_name, expected: 0 });
      expected.get(key)!.expected += winFrac;
    }
  }

  const actual = getDb()
    .prepare(
      `SELECT t.primary_owner AS member_id, COALESCE(m.display_name,'Unknown') AS display_name,
              SUM(t.wins) AS wins, SUM(t.losses) AS losses, SUM(t.ties) AS ties
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.primary_owner IS NOT NULL
       GROUP BY t.primary_owner`
    )
    .all() as { member_id: string; display_name: string; wins: number; losses: number; ties: number }[];

  const result: LuckRow[] = [];
  for (const a of actual) {
    const e = expected.get(a.member_id) ?? expected.get(a.display_name);
    if (!e) continue;
    const actualWins = a.wins + a.ties * 0.5;
    result.push({
      member_id: a.member_id,
      display_name: a.display_name,
      games: a.wins + a.losses + a.ties,
      actual_wins: actualWins,
      expected_wins: Math.round(e.expected * 10) / 10,
      luck: Math.round((actualWins - e.expected) * 10) / 10,
    });
  }
  return result.sort((x, y) => y.luck - x.luck);
}

export type ConsistencyRow = {
  display_name: string;
  games: number;
  avg: number;
  stdev: number;
};

export function getScoringConsistency(): ConsistencyRow[] {
  const rows = getAllWeeklyScores();
  const byManager = new Map<string, number[]>();
  for (const r of rows) {
    if (!byManager.has(r.display_name)) byManager.set(r.display_name, []);
    byManager.get(r.display_name)!.push(r.score);
  }
  const result: ConsistencyRow[] = [];
  for (const [display_name, scores] of byManager) {
    if (scores.length < 10) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - avg) ** 2, 0) / scores.length;
    result.push({
      display_name,
      games: scores.length,
      avg: Math.round(avg * 10) / 10,
      stdev: Math.round(Math.sqrt(variance) * 10) / 10,
    });
  }
  return result.sort((a, b) => b.stdev - a.stdev);
}

// All-play record: for every team-week, count how many *other* teams in the
// league that week they'd have beaten/lost to/tied, regardless of actual
// opponent. Strips out schedule luck entirely — this is the "true" record.
export type AllPlayRow = {
  display_name: string;
  wins: number;
  losses: number;
  ties: number;
};

export function getAllPlayRecord(): AllPlayRow[] {
  const rows = getAllWeeklyScores();
  const byWeek = new Map<string, WeeklyScoreRow[]>();
  for (const r of rows) {
    const key = `${r.season}-${r.week}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(r);
  }

  const totals = new Map<string, AllPlayRow>();
  for (const group of byWeek.values()) {
    if (group.length < 2) continue;
    for (const team of group) {
      const wins = group.filter((g) => g.score < team.score).length;
      const losses = group.filter((g) => g.score > team.score).length;
      const ties = group.length - 1 - wins - losses;
      if (!totals.has(team.display_name)) {
        totals.set(team.display_name, { display_name: team.display_name, wins: 0, losses: 0, ties: 0 });
      }
      const t = totals.get(team.display_name)!;
      t.wins += wins;
      t.losses += losses;
      t.ties += ties;
    }
  }
  return [...totals.values()].sort(
    (a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses)
  );
}

const STARTER_SLOT = { QB: 0, RB: 2, WR: 4, TE: 6, DST: 16, K: 17 } as const;
const BENCH_SLOTS = new Set([20, 21]);
const POSITION_TO_SLOT: Record<number, keyof typeof STARTER_SLOT> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};
const REQUIRED_COUNTS: Record<keyof typeof STARTER_SLOT, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  DST: 1,
  K: 1,
};
const FLEX_ELIGIBLE = new Set<keyof typeof STARTER_SLOT>(["RB", "WR", "TE"]);

type RosterEntry = {
  season: number;
  week: number;
  team_id: number;
  player_id: number;
  lineup_slot_id: number;
  points: number;
  position_id: number | null;
  display_name: string;
};

function getAllRosterEntries(): RosterEntry[] {
  return getDb()
    .prepare(
      `SELECT pws.season, pws.week, pws.team_id, pws.player_id, pws.lineup_slot_id, pws.points,
              p.position_id, COALESCE(m.display_name,'Unknown') AS display_name
       FROM player_weekly_scores pws
       JOIN teams t ON t.season = pws.season AND t.team_id = pws.team_id
       LEFT JOIN players p ON p.player_id = pws.player_id
       LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE pws.points IS NOT NULL`
    )
    .all() as RosterEntry[];
}

// "Optimal lineup" is computed greedily by position group (not a full
// eligible-slot solver), which is standard practice for this kind of
// analysis and matches what public fantasy tools report.
function optimalLineupPoints(roster: RosterEntry[]): number {
  const byPos = new Map<keyof typeof STARTER_SLOT, RosterEntry[]>();
  for (const e of roster) {
    const pos = e.position_id != null ? POSITION_TO_SLOT[e.position_id] : undefined;
    if (!pos) continue;
    if (!byPos.has(pos)) byPos.set(pos, []);
    byPos.get(pos)!.push(e);
  }
  for (const list of byPos.values()) list.sort((a, b) => b.points - a.points);

  let total = 0;
  const leftovers: RosterEntry[] = [];
  for (const pos of Object.keys(REQUIRED_COUNTS) as (keyof typeof STARTER_SLOT)[]) {
    const list = byPos.get(pos) ?? [];
    const need = REQUIRED_COUNTS[pos];
    for (let i = 0; i < list.length; i++) {
      if (i < need) total += list[i].points;
      else if (FLEX_ELIGIBLE.has(pos)) leftovers.push(list[i]);
    }
  }
  leftovers.sort((a, b) => b.points - a.points);
  if (leftovers.length > 0) total += leftovers[0].points;
  return total;
}

export type BenchRegretRow = {
  display_name: string;
  games: number;
  total_regret: number;
  avg_regret: number;
  worst_week_regret: number;
  worst_week_season: number;
  worst_week_num: number;
};

export function getBenchRegret(): BenchRegretRow[] {
  const all = getAllRosterEntries();
  const byTeamWeek = new Map<string, RosterEntry[]>();
  for (const e of all) {
    const key = `${e.season}-${e.week}-${e.team_id}`;
    if (!byTeamWeek.has(key)) byTeamWeek.set(key, []);
    byTeamWeek.get(key)!.push(e);
  }

  const perManager = new Map<
    string,
    { games: number; total: number; worst: number; worstSeason: number; worstWeek: number }
  >();

  for (const [key, roster] of byTeamWeek) {
    const [season, week] = key.split("-").map(Number);
    const actual = roster
      .filter((e) => !BENCH_SLOTS.has(e.lineup_slot_id))
      .reduce((s, e) => s + e.points, 0);
    const optimal = optimalLineupPoints(roster);
    const regret = Math.max(0, optimal - actual);
    const display_name = roster[0].display_name;

    if (!perManager.has(display_name)) {
      perManager.set(display_name, { games: 0, total: 0, worst: 0, worstSeason: 0, worstWeek: 0 });
    }
    const m = perManager.get(display_name)!;
    m.games += 1;
    m.total += regret;
    if (regret > m.worst) {
      m.worst = regret;
      m.worstSeason = season;
      m.worstWeek = week;
    }
  }

  return [...perManager.entries()]
    .map(([display_name, m]) => ({
      display_name,
      games: m.games,
      total_regret: Math.round(m.total * 10) / 10,
      avg_regret: Math.round((m.total / m.games) * 10) / 10,
      worst_week_regret: Math.round(m.worst * 10) / 10,
      worst_week_season: m.worstSeason,
      worst_week_num: m.worstWeek,
    }))
    .sort((a, b) => b.total_regret - a.total_regret);
}

// Draft ROI: rank every drafted player, that season, by total points scored.
// value = pick_number - performance_rank. Positive = steal (a late pick who
// outperformed players taken way earlier). Negative = bust.
export type DraftValueRow = {
  season: number;
  overall_pick: number;
  player_name: string;
  team_name: string;
  display_name: string;
  season_points: number;
  performance_rank: number;
  value: number;
};

export function getDraftValue(): DraftValueRow[] {
  const seasonPoints = getDb()
    .prepare(
      `SELECT season, player_id, SUM(points) AS total
       FROM (SELECT DISTINCT season, week, player_id, points FROM player_weekly_scores)
       GROUP BY season, player_id`
    )
    .all() as { season: number; player_id: number; total: number }[];

  const pointsMap = new Map<string, number>();
  for (const r of seasonPoints) pointsMap.set(`${r.season}-${r.player_id}`, r.total);

  const picks = getDb()
    .prepare(
      `SELECT d.season, d.overall_pick, d.player_id, d.team_id,
              p.full_name AS player_name, t.name AS team_name,
              COALESCE(m.display_name,'Unknown') AS display_name
       FROM draft_picks d
       LEFT JOIN players p ON p.player_id = d.player_id
       LEFT JOIN teams t ON t.season = d.season AND t.team_id = d.team_id
       LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE d.player_id != -1`
    )
    .all() as {
    season: number;
    overall_pick: number;
    player_id: number;
    team_id: number;
    player_name: string;
    team_name: string;
    display_name: string;
  }[];

  const bySeason = new Map<number, typeof picks>();
  for (const p of picks) {
    if (!bySeason.has(p.season)) bySeason.set(p.season, []);
    bySeason.get(p.season)!.push(p);
  }

  const result: DraftValueRow[] = [];
  for (const [season, seasonPicks] of bySeason) {
    const withPoints = seasonPicks
      .map((p) => ({ ...p, points: pointsMap.get(`${p.season}-${p.player_id}`) ?? 0 }))
      .sort((a, b) => b.points - a.points);
    withPoints.forEach((p, i) => {
      const rank = i + 1;
      result.push({
        season,
        overall_pick: p.overall_pick,
        player_name: p.player_name ?? `#${p.player_id}`,
        team_name: p.team_name,
        display_name: p.display_name,
        season_points: Math.round(p.points * 10) / 10,
        performance_rank: rank,
        value: p.overall_pick - rank,
      });
    });
  }
  return result.sort((a, b) => b.value - a.value);
}

// Longest win/loss streaks, career-wide, ordered chronologically per manager.
export type StreakRow = {
  display_name: string;
  type: "win" | "loss";
  length: number;
  start_season: number;
  start_week: number;
  end_season: number;
  end_week: number;
};

export function getLongestStreaks(): StreakRow[] {
  const matchups = getDb()
    .prepare(
      `SELECT ms.season, ms.week, ms.home_score, ms.away_score,
              COALESCE(hm.display_name,'Unknown') AS home_owner,
              COALESCE(am.display_name,'Unknown') AS away_owner
       FROM matchups ms
       JOIN teams ht ON ms.season = ht.season AND ms.home_team_id = ht.team_id
       JOIN teams at ON ms.season = at.season AND ms.away_team_id = at.team_id
       LEFT JOIN members hm ON ht.primary_owner = hm.member_id
       LEFT JOIN members am ON at.primary_owner = am.member_id
       WHERE ms.home_score + ms.away_score > 0
       ORDER BY ms.season ASC, ms.week ASC`
    )
    .all() as {
    season: number;
    week: number;
    home_score: number;
    away_score: number;
    home_owner: string;
    away_owner: string;
  }[];

  const byManager = new Map<string, { season: number; week: number; result: "win" | "loss" }[]>();
  for (const m of matchups) {
    if (m.home_score === m.away_score) continue;
    const homeResult = m.home_score > m.away_score ? "win" : "loss";
    const awayResult = homeResult === "win" ? "loss" : "win";
    if (!byManager.has(m.home_owner)) byManager.set(m.home_owner, []);
    if (!byManager.has(m.away_owner)) byManager.set(m.away_owner, []);
    byManager.get(m.home_owner)!.push({ season: m.season, week: m.week, result: homeResult });
    byManager.get(m.away_owner)!.push({ season: m.season, week: m.week, result: awayResult });
  }

  const best: StreakRow[] = [];
  for (const [display_name, games] of byManager) {
    let curType: "win" | "loss" | null = null;
    let curLen = 0;
    let curStart = games[0];
    let bestWin: StreakRow | null = null;
    let bestLoss: StreakRow | null = null;

    for (const g of games) {
      if (g.result === curType) {
        curLen += 1;
      } else {
        curType = g.result;
        curLen = 1;
        curStart = g;
      }
      const candidate: StreakRow = {
        display_name,
        type: curType,
        length: curLen,
        start_season: curStart.season,
        start_week: curStart.week,
        end_season: g.season,
        end_week: g.week,
      };
      if (curType === "win" && (!bestWin || curLen > bestWin.length)) bestWin = candidate;
      if (curType === "loss" && (!bestLoss || curLen > bestLoss.length)) bestLoss = candidate;
    }
    if (bestWin) best.push(bestWin);
    if (bestLoss) best.push(bestLoss);
  }
  return best.sort((a, b) => b.length - a.length);
}

export type H2HRow = {
  a: string;
  b: string;
  a_wins: number;
  b_wins: number;
  ties: number;
};

export function getHeadToHead(): H2HRow[] {
  const matchups = getDb()
    .prepare(
      `SELECT ms.home_score, ms.away_score,
              COALESCE(hm.display_name,'Unknown') AS home_owner,
              COALESCE(am.display_name,'Unknown') AS away_owner
       FROM matchups ms
       JOIN teams ht ON ms.season = ht.season AND ms.home_team_id = ht.team_id
       JOIN teams at ON ms.season = at.season AND ms.away_team_id = at.team_id
       LEFT JOIN members hm ON ht.primary_owner = hm.member_id
       LEFT JOIN members am ON at.primary_owner = am.member_id
       WHERE ms.home_score + ms.away_score > 0 AND ht.primary_owner != at.primary_owner`
    )
    .all() as { home_score: number; away_score: number; home_owner: string; away_owner: string }[];

  const pairs = new Map<string, H2HRow>();
  for (const m of matchups) {
    const [a, b] = [m.home_owner, m.away_owner].sort();
    const key = `${a}|${b}`;
    if (!pairs.has(key)) pairs.set(key, { a, b, a_wins: 0, b_wins: 0, ties: 0 });
    const row = pairs.get(key)!;
    if (m.home_score === m.away_score) {
      row.ties += 1;
    } else {
      const winner = m.home_score > m.away_score ? m.home_owner : m.away_owner;
      if (winner === a) row.a_wins += 1;
      else row.b_wins += 1;
    }
  }
  return [...pairs.values()].sort(
    (x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b)
  );
}
