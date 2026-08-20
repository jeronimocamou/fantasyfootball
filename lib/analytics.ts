import { getDb } from "./db";

export type WeeklyScoreRow = {
  season: number;
  week: number;
  team_id: number;
  member_id: string | null;
  display_name: string;
  score: number;
};

// regularSeasonOnly excludes playoff bracket matchups (WINNERS_BRACKET,
// LOSERS_CONSOLATION_LADDER, etc). teams.wins/losses/ties only tallies the
// regular-season record, so anything comparing scores against that record
// (e.g. the luck index) must use this to keep the two in sync.
export function getAllWeeklyScores(regularSeasonOnly = false): WeeklyScoreRow[] {
  const tierFilter = regularSeasonOnly ? " AND playoff_tier_type = 'NONE'" : "";
  return getDb()
    .prepare(
      `SELECT sc.season, sc.week, sc.team_id, t.primary_owner AS member_id,
              COALESCE(m.display_name, 'Unknown') AS display_name, sc.score
       FROM (
         SELECT season, week, home_team_id AS team_id, home_score AS score FROM matchups WHERE home_score + away_score > 0${tierFilter}
         UNION ALL
         SELECT season, week, away_team_id AS team_id, away_score AS score FROM matchups WHERE home_score + away_score > 0${tierFilter}
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
//
// Restricted to regular-season weeks: teams.wins/losses/ties (the "actual"
// side) never counts playoff bracket games, so including those weeks here
// would inflate expected wins for every playoff team without a matching
// actual win, making almost everyone read as unlucky.
export type LuckRow = {
  member_id: string;
  display_name: string;
  games: number;
  actual_wins: number;
  expected_wins: number;
  luck: number;
};

export function getLuckIndex(): LuckRow[] {
  const rows = getAllWeeklyScores(true);
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
      const key = team.display_name;
      if (!expected.has(key)) expected.set(key, { display_name: team.display_name, expected: 0 });
      expected.get(key)!.expected += winFrac;
    }
  }

  // Actual wins must come from the exact same set of games as "expected"
  // above (every recorded matchup, including playoffs/consolation) — not
  // teams.wins, which is ESPN's regular-season-only record. Mixing the two
  // undercounts actual wins relative to expected and makes everyone look
  // unlucky.
  const matchups = getRivalryMatchups();
  const actual = new Map<string, { display_name: string; wins: number; losses: number; ties: number }>();
  for (const m of matchups) {
    for (const [owner, isHome] of [
      [m.home_owner, true],
      [m.away_owner, false],
    ] as const) {
      if (!actual.has(owner)) actual.set(owner, { display_name: owner, wins: 0, losses: 0, ties: 0 });
      const rec = actual.get(owner)!;
      if (m.home_score === m.away_score) rec.ties += 1;
      else if ((m.home_score > m.away_score) === isHome) rec.wins += 1;
      else rec.losses += 1;
    }
  }

  const result: LuckRow[] = [];
  for (const [display_name, a] of actual) {
    const e = expected.get(display_name);
    if (!e) continue;
    const actualWins = a.wins + a.ties * 0.5;
    result.push({
      member_id: display_name,
      display_name,
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
    (a, b) => b.wins / (b.wins + b.losses + b.ties) - a.wins / (a.wins + a.losses + a.ties)
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
  seasons: number;
  first_season: number;
  last_season: number;
  avg_margin: number;
};

type RivalryMatchup = {
  season: number;
  home_score: number;
  away_score: number;
  home_owner: string;
  away_owner: string;
};

function getRivalryMatchups(): RivalryMatchup[] {
  return getDb()
    .prepare(
      `SELECT ms.season, ms.home_score, ms.away_score,
              COALESCE(hm.display_name,'Unknown') AS home_owner,
              COALESCE(am.display_name,'Unknown') AS away_owner
       FROM matchups ms
       JOIN teams ht ON ms.season = ht.season AND ms.home_team_id = ht.team_id
       JOIN teams at ON ms.season = at.season AND ms.away_team_id = at.team_id
       LEFT JOIN members hm ON ht.primary_owner = hm.member_id
       LEFT JOIN members am ON at.primary_owner = am.member_id
       WHERE ms.home_score + ms.away_score > 0 AND ht.primary_owner != at.primary_owner`
    )
    .all() as RivalryMatchup[];
}

export function getHeadToHead(): H2HRow[] {
  const matchups = getRivalryMatchups();

  const pairs = new Map<
    string,
    H2HRow & { seasonSet: Set<number>; marginSum: number; games: number }
  >();
  for (const m of matchups) {
    const [a, b] = [m.home_owner, m.away_owner].sort();
    const key = `${a}|${b}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        a,
        b,
        a_wins: 0,
        b_wins: 0,
        ties: 0,
        seasons: 0,
        first_season: m.season,
        last_season: m.season,
        avg_margin: 0,
        seasonSet: new Set(),
        marginSum: 0,
        games: 0,
      });
    }
    const row = pairs.get(key)!;
    row.seasonSet.add(m.season);
    row.first_season = Math.min(row.first_season, m.season);
    row.last_season = Math.max(row.last_season, m.season);
    row.marginSum += Math.abs(m.home_score - m.away_score);
    row.games += 1;
    if (m.home_score === m.away_score) {
      row.ties += 1;
    } else {
      const winner = m.home_score > m.away_score ? m.home_owner : m.away_owner;
      if (winner === a) row.a_wins += 1;
      else row.b_wins += 1;
    }
  }

  return [...pairs.values()]
    .map((row) => ({
      a: row.a,
      b: row.b,
      a_wins: row.a_wins,
      b_wins: row.b_wins,
      ties: row.ties,
      seasons: row.seasonSet.size,
      first_season: row.first_season,
      last_season: row.last_season,
      avg_margin: Math.round((row.marginSum / row.games) * 10) / 10,
    }))
    .sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}

// Each manager's toughest opponent: the one they have the worst win% against
// (minimum 4 meetings, to avoid noise from one-off matchups).
export type NemesisRow = {
  display_name: string;
  nemesis: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
};

export function getNemeses(): NemesisRow[] {
  const matchups = getRivalryMatchups();
  const vs = new Map<string, Map<string, { w: number; l: number; t: number }>>();

  const record = (m: string, opp: string, key: "w" | "l" | "t") => {
    if (!vs.has(m)) vs.set(m, new Map());
    const opps = vs.get(m)!;
    if (!opps.has(opp)) opps.set(opp, { w: 0, l: 0, t: 0 });
    opps.get(opp)![key] += 1;
  };

  for (const m of matchups) {
    if (m.home_score === m.away_score) {
      record(m.home_owner, m.away_owner, "t");
      record(m.away_owner, m.home_owner, "t");
    } else {
      const winner = m.home_score > m.away_score ? m.home_owner : m.away_owner;
      const loser = winner === m.home_owner ? m.away_owner : m.home_owner;
      record(winner, loser, "w");
      record(loser, winner, "l");
    }
  }

  const result: NemesisRow[] = [];
  for (const [display_name, opps] of vs) {
    let worst: { opp: string; wins: number; losses: number; ties: number; winPct: number } | null = null;
    for (const [opp, rec] of opps) {
      const total = rec.w + rec.l + rec.t;
      if (total < 4) continue;
      const winPct = rec.w / total;
      if (!worst || winPct < worst.winPct) {
        worst = { opp, wins: rec.w, losses: rec.l, ties: rec.t, winPct };
      }
    }
    if (worst) {
      result.push({
        display_name,
        nemesis: worst.opp,
        wins: worst.wins,
        losses: worst.losses,
        ties: worst.ties,
        win_pct: Math.round(worst.winPct * 1000) / 10,
      });
    }
  }
  return result.sort((a, b) => a.win_pct - b.win_pct);
}

// Championship / playoff droughts, relative to the most recent completed season.
export type DroughtRow = {
  display_name: string;
  last_title_season: number | null;
  title_drought: number | null;
  last_playoff_season: number | null;
  playoff_drought: number | null;
};

export function getDroughts(): DroughtRow[] {
  const currentSeason = (
    getDb()
      .prepare(
        `SELECT MAX(season) AS s FROM teams WHERE wins + losses + ties > 0`
      )
      .get() as { s: number }
  ).s;

  const titles = getDb()
    .prepare(
      `SELECT t.primary_owner AS member_id, COALESCE(m.display_name,'Unknown') AS display_name, MAX(t.season) AS last_title
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.final_rank = 1 AND t.primary_owner IS NOT NULL
       GROUP BY t.primary_owner`
    )
    .all() as { member_id: string; display_name: string; last_title: number }[];

  const playoffs = getDb()
    .prepare(
      `SELECT t.primary_owner AS member_id, MAX(ms.season) AS last_playoff
       FROM matchups ms
       JOIN teams t ON t.season = ms.season
         AND t.team_id IN (ms.home_team_id, ms.away_team_id)
       WHERE ms.playoff_tier_type = 'WINNERS_BRACKET' AND t.primary_owner IS NOT NULL
       GROUP BY t.primary_owner`
    )
    .all() as { member_id: string; last_playoff: number }[];
  const playoffMap = new Map(playoffs.map((p) => [p.member_id, p.last_playoff]));

  const allManagers = getDb()
    .prepare(
      `SELECT DISTINCT t.primary_owner AS member_id, COALESCE(m.display_name,'Unknown') AS display_name
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.primary_owner IS NOT NULL AND t.wins + t.losses + t.ties > 0`
    )
    .all() as { member_id: string; display_name: string }[];
  const titleMap = new Map(titles.map((t) => [t.member_id, t.last_title]));

  return allManagers
    .map((m) => {
      const lastTitle = titleMap.get(m.member_id) ?? null;
      const lastPlayoff = playoffMap.get(m.member_id) ?? null;
      return {
        display_name: m.display_name,
        last_title_season: lastTitle,
        title_drought: lastTitle != null ? currentSeason - lastTitle : null,
        last_playoff_season: lastPlayoff,
        playoff_drought: lastPlayoff != null ? currentSeason - lastPlayoff : null,
      };
    })
    .sort((a, b) => {
      const ad = a.title_drought ?? 999;
      const bd = b.title_drought ?? 999;
      return bd - ad;
    });
}

const POSITION_NAMES: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

// For each manager+position, how many rounds earlier/later than the league
// average that season they tend to draft that position. Negative = reaches
// early, positive = waits.
export type DraftTendencyRow = {
  display_name: string;
  position: string;
  picks: number;
  avg_round_diff: number;
};

export function getDraftTendency(): DraftTendencyRow[] {
  const picks = getDb()
    .prepare(
      `SELECT d.season, p.position_id, d.round_id, COALESCE(m.display_name,'Unknown') AS display_name
       FROM draft_picks d
       JOIN players p ON p.player_id = d.player_id
       LEFT JOIN teams t ON t.season = d.season AND t.team_id = d.team_id
       LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE d.player_id != -1 AND p.position_id IS NOT NULL`
    )
    .all() as { season: number; position_id: number; round_id: number; display_name: string }[];

  const leagueAvg = new Map<string, { sum: number; count: number }>();
  for (const p of picks) {
    const key = `${p.season}-${p.position_id}`;
    if (!leagueAvg.has(key)) leagueAvg.set(key, { sum: 0, count: 0 });
    const e = leagueAvg.get(key)!;
    e.sum += p.round_id;
    e.count += 1;
  }

  const perManager = new Map<string, { sum: number; count: number }>();
  for (const p of picks) {
    const leagueKey = `${p.season}-${p.position_id}`;
    const league = leagueAvg.get(leagueKey)!;
    const leagueMean = league.sum / league.count;
    const diff = p.round_id - leagueMean;

    const key = `${p.display_name}|${p.position_id}`;
    if (!perManager.has(key)) perManager.set(key, { sum: 0, count: 0 });
    const e = perManager.get(key)!;
    e.sum += diff;
    e.count += 1;
  }

  const result: DraftTendencyRow[] = [];
  for (const [key, e] of perManager) {
    if (e.count < 3) continue;
    const [display_name, positionId] = key.split("|");
    result.push({
      display_name,
      position: POSITION_NAMES[Number(positionId)] ?? positionId,
      picks: e.count,
      avg_round_diff: Math.round((e.sum / e.count) * 10) / 10,
    });
  }
  return result.sort((a, b) => a.avg_round_diff - b.avg_round_diff);
}

// A speculative "power ranking" for the upcoming season, based entirely on
// history — the draft hasn't happened yet, so this can't know anything
// about actual 2026 rosters. It's a recency-weighted blend of all-play win%
// (the schedule-luck-free skill measure), favoring recent seasons 3:2:1.
export type PredictedStandingRow = {
  display_name: string;
  team_name: string;
  predicted_rank: number;
  weighted_win_pct: number;
  career_win_pct: number;
  seasons_used: number;
  trend: "up" | "down" | "flat";
};

export function getPredictedStandings(): PredictedStandingRow[] {
  const current2026 = getDb()
    .prepare(
      `SELECT t.team_id, t.name AS team_name, COALESCE(m.display_name,'Unknown') AS display_name
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.season = 2026`
    )
    .all() as { team_id: number; team_name: string; display_name: string }[];

  const weeklyScores = getAllWeeklyScores();
  const byManagerSeason = new Map<string, Map<number, WeeklyScoreRow[]>>();
  for (const r of weeklyScores) {
    if (!byManagerSeason.has(r.display_name)) byManagerSeason.set(r.display_name, new Map());
    const seasons = byManagerSeason.get(r.display_name)!;
    if (!seasons.has(r.season)) seasons.set(r.season, []);
    seasons.get(r.season)!.push(r);
  }

  const byWeekAllScores = new Map<string, WeeklyScoreRow[]>();
  for (const r of weeklyScores) {
    const key = `${r.season}-${r.week}`;
    if (!byWeekAllScores.has(key)) byWeekAllScores.set(key, []);
    byWeekAllScores.get(key)!.push(r);
  }

  function allPlayPctForSeason(display_name: string, season: number): number | null {
    const games = byManagerSeason.get(display_name)?.get(season);
    if (!games || games.length === 0) return null;
    let wins = 0;
    let total = 0;
    for (const g of games) {
      const field = byWeekAllScores.get(`${g.season}-${g.week}`)!;
      const lower = field.filter((f) => f.score < g.score).length;
      const equal = field.filter((f) => f.score === g.score).length - 1;
      wins += lower + equal * 0.5;
      total += field.length - 1;
    }
    return total > 0 ? wins / total : null;
  }

  const career = getAllPlayRecord();
  const careerMap = new Map(career.map((c) => [c.display_name, c.wins / (c.wins + c.losses + c.ties)]));

  const result: PredictedStandingRow[] = [];
  for (const team of current2026) {
    const seasons = [...(byManagerSeason.get(team.display_name)?.keys() ?? [])].sort((a, b) => b - a);
    const recent = seasons.slice(0, 3);
    const weights = [3, 2, 1];
    let weightedSum = 0;
    let weightTotal = 0;
    recent.forEach((season, i) => {
      const pct = allPlayPctForSeason(team.display_name, season);
      if (pct != null) {
        weightedSum += pct * weights[i];
        weightTotal += weights[i];
      }
    });
    const careerPct = careerMap.get(team.display_name) ?? 0.5;
    const weightedPct = weightTotal > 0 ? weightedSum / weightTotal : careerPct;

    const mostRecentPct = recent.length > 0 ? allPlayPctForSeason(team.display_name, recent[0]) : null;
    const priorPct = recent.length > 1 ? allPlayPctForSeason(team.display_name, recent[1]) : null;
    let trend: "up" | "down" | "flat" = "flat";
    if (mostRecentPct != null && priorPct != null) {
      if (mostRecentPct - priorPct > 0.05) trend = "up";
      else if (priorPct - mostRecentPct > 0.05) trend = "down";
    }

    result.push({
      display_name: team.display_name,
      team_name: team.team_name,
      predicted_rank: 0,
      weighted_win_pct: Math.round(weightedPct * 1000) / 10,
      career_win_pct: Math.round(careerPct * 1000) / 10,
      seasons_used: recent.length,
      trend,
    });
  }

  result.sort((a, b) => b.weighted_win_pct - a.weighted_win_pct);
  result.forEach((r, i) => (r.predicted_rank = i + 1));
  return result;
}
