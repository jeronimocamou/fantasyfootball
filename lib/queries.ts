import { getPool } from "./pg";
import { computeLine, gradeSide, profitForOdds, DEFAULT_ODDS } from "./betting";
import { fetchLeagueLive, type EspnTeam } from "./espn";
import { WEEKLY_ALLOWANCE, MIN_BET } from "./bettingConstants";

export { WEEKLY_ALLOWANCE, MIN_BET };

export type Manager = {
  id: number;
  espn_team_id: number;
  display_name: string;
  team_name: string;
};

export async function getManagers(): Promise<Manager[]> {
  const { rows } = await getPool().query(
    `SELECT id, espn_team_id, display_name, team_name FROM managers ORDER BY display_name`
  );
  return rows;
}

// Keeps `managers` in sync with ESPN's team list/names, and lets the
// operator assign real display names once via UPDATE — this only touches
// team_name and inserts newly-seen teams, never overwrites display_name.
async function seedManagers(teams: EspnTeam[]) {
  const pool = getPool();
  for (const t of teams) {
    await pool.query(
      `INSERT INTO managers (espn_team_id, display_name, team_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (espn_team_id) DO UPDATE SET team_name = excluded.team_name`,
      [t.id, t.name, t.name]
    );
  }
}

type LineRow = {
  id: number;
  season: number;
  week: number;
  team_a_id: number;
  team_b_id: number;
  proj_a: string;
  proj_b: string;
  spread: string;
  odds: number;
  status: "open" | "locked" | "final";
  actual_a: string | null;
  actual_b: string | null;
};

async function getLine(
  season: number,
  week: number,
  teamAId: number,
  teamBId: number
): Promise<LineRow | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM weekly_lines WHERE season=$1 AND week=$2 AND team_a_id=$3 AND team_b_id=$4`,
    [season, week, teamAId, teamBId]
  );
  return rows[0] ?? null;
}

async function settleLine(lineId: number) {
  const pool = getPool();
  const { rows: lineRows } = await pool.query(`SELECT * FROM weekly_lines WHERE id=$1`, [lineId]);
  const line = lineRows[0] as LineRow;
  if (!line || line.actual_a == null || line.actual_b == null) return;

  const actualA = Number(line.actual_a);
  const actualB = Number(line.actual_b);
  const spreadA = Number(line.spread);

  const { rows: bets } = await pool.query(
    `SELECT * FROM bets WHERE line_id=$1 AND status='pending'`,
    [lineId]
  );

  for (const bet of bets) {
    const side = bet.side_manager_id === line.team_a_id ? "a" : "b";
    const outcome = gradeSide(actualA, actualB, spreadA, side);
    const amount = Number(bet.amount);
    let payout = 0;
    if (outcome === "won") payout = amount + profitForOdds(amount, bet.odds);
    else if (outcome === "push") payout = amount;

    await pool.query(
      `UPDATE bets SET status=$1, payout=$2, settled_at=now() WHERE id=$3`,
      [outcome, payout, bet.id]
    );
  }

  await pool.query(`UPDATE weekly_lines SET settled_at=now() WHERE id=$1`, [lineId]);
}

// Pulls current ESPN state and walks the whole schedule, advancing each
// matchup's line through open -> locked (as soon as any live scoring shows
// up that week) -> final (once ESPN reports a decided winner), settling
// bets the moment a line goes final. Safe to call repeatedly/on a cron.
export async function syncSeason(season: number) {
  const data = await fetchLeagueLive(season);
  await seedManagers(data.teams);

  const { rows: managerRows } = await getPool().query(
    `SELECT id, espn_team_id FROM managers`
  );
  const managerByEspnId = new Map<number, number>(
    managerRows.map((r) => [r.espn_team_id, r.id])
  );

  for (const m of data.schedule) {
    if (!m.home?.teamId || !m.away?.teamId) continue; // bye week
    const teamAId = managerByEspnId.get(m.home.teamId);
    const teamBId = managerByEspnId.get(m.away.teamId);
    if (!teamAId || !teamBId) continue;

    const isDecided = m.winner !== "UNDECIDED";
    const hasLiveScoring = m.home.totalPoints > 0 || m.away.totalPoints > 0;
    const existing = await getLine(season, m.matchupPeriodId, teamAId, teamBId);

    // ESPN's schedule includes every week of the season, but
    // totalProjectedPoints is only meaningful for the current scoring
    // period — future weeks report 0. Never create a line off that.
    if (!existing && m.matchupPeriodId !== data.scoringPeriodId) continue;

    if (!existing) {
      const { spreadA } = computeLine(m.home.totalProjectedPoints, m.away.totalProjectedPoints);
      const status = isDecided ? "final" : hasLiveScoring ? "locked" : "open";
      const { rows } = await getPool().query(
        `INSERT INTO weekly_lines
           (season, week, team_a_id, team_b_id, proj_a, proj_b, spread, odds, status,
            actual_a, actual_b, locked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $9 != 'open' THEN now() END)
         RETURNING id`,
        [
          season, m.matchupPeriodId, teamAId, teamBId,
          m.home.totalProjectedPoints, m.away.totalProjectedPoints, spreadA, DEFAULT_ODDS, status,
          isDecided ? m.home.totalPoints : null, isDecided ? m.away.totalPoints : null,
        ]
      );
      if (isDecided) await settleLine(rows[0].id);
      continue;
    }

    if (existing.status === "open") {
      if (isDecided) {
        await getPool().query(
          `UPDATE weekly_lines SET status='final', actual_a=$1, actual_b=$2, locked_at=now() WHERE id=$3`,
          [m.home.totalPoints, m.away.totalPoints, existing.id]
        );
        await settleLine(existing.id);
      } else if (hasLiveScoring) {
        await getPool().query(`UPDATE weekly_lines SET status='locked', locked_at=now() WHERE id=$1`, [existing.id]);
      } else {
        const { spreadA } = computeLine(m.home.totalProjectedPoints, m.away.totalProjectedPoints);
        await getPool().query(
          `UPDATE weekly_lines SET proj_a=$1, proj_b=$2, spread=$3 WHERE id=$4`,
          [m.home.totalProjectedPoints, m.away.totalProjectedPoints, spreadA, existing.id]
        );
      }
    } else if (existing.status === "locked" && isDecided) {
      await getPool().query(
        `UPDATE weekly_lines SET status='final', actual_a=$1, actual_b=$2 WHERE id=$3`,
        [m.home.totalPoints, m.away.totalPoints, existing.id]
      );
      await settleLine(existing.id);
    }
  }
}

export type BoardLine = LineRow & {
  team_a_name: string;
  team_a_team: string;
  team_b_name: string;
  team_b_team: string;
};

export async function getWeekBoard(season: number, week: number): Promise<BoardLine[]> {
  const { rows } = await getPool().query(
    `SELECT wl.*,
            ma.display_name AS team_a_name, ma.team_name AS team_a_team,
            mb.display_name AS team_b_name, mb.team_name AS team_b_team
     FROM weekly_lines wl
     JOIN managers ma ON ma.id = wl.team_a_id
     JOIN managers mb ON mb.id = wl.team_b_id
     WHERE wl.season = $1 AND wl.week = $2
     ORDER BY wl.id`,
    [season, week]
  );
  return rows;
}

export async function getCurrentWeek(season: number): Promise<number | null> {
  const { rows } = await getPool().query(
    `SELECT MAX(week) AS w FROM weekly_lines WHERE season = $1`,
    [season]
  );
  return rows[0]?.w ?? null;
}

export async function getManagerWeekSpent(managerId: number, season: number, week: number): Promise<number> {
  const { rows } = await getPool().query(
    `SELECT COALESCE(SUM(b.amount), 0) AS spent
     FROM bets b JOIN weekly_lines wl ON wl.id = b.line_id
     WHERE b.manager_id = $1 AND wl.season = $2 AND wl.week = $3`,
    [managerId, season, week]
  );
  return Number(rows[0].spent);
}

export type PlaceBetResult =
  | { ok: true; betId: number }
  | { ok: false; error: string };

export async function placeBet(
  managerId: number,
  lineId: number,
  sideManagerId: number,
  amount: number
): Promise<PlaceBetResult> {
  if (amount < MIN_BET) return { ok: false, error: `Minimum bet is $${MIN_BET}.` };

  const { rows: lineRows } = await getPool().query(`SELECT * FROM weekly_lines WHERE id=$1`, [lineId]);
  const line = lineRows[0] as LineRow | undefined;
  if (!line) return { ok: false, error: "Line not found." };
  if (line.status !== "open") return { ok: false, error: "This line is no longer open for betting." };
  if (sideManagerId !== line.team_a_id && sideManagerId !== line.team_b_id) {
    return { ok: false, error: "Invalid side for this matchup." };
  }
  if (managerId === line.team_a_id || managerId === line.team_b_id) {
    return { ok: false, error: "You can't bet on your own matchup." };
  }

  const spent = await getManagerWeekSpent(managerId, line.season, line.week);
  if (spent + amount > WEEKLY_ALLOWANCE + 1e-9) {
    return { ok: false, error: `Only $${(WEEKLY_ALLOWANCE - spent).toFixed(2)} of your weekly $${WEEKLY_ALLOWANCE} left.` };
  }

  const { rows } = await getPool().query(
    `INSERT INTO bets (manager_id, line_id, side_manager_id, amount, odds)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [managerId, lineId, sideManagerId, amount, line.odds]
  );
  return { ok: true, betId: rows[0].id };
}

export type BetHistoryRow = {
  id: number;
  amount: string;
  odds: number;
  status: string;
  payout: string | null;
  placed_at: string;
  season: number;
  week: number;
  spread: string;
  side_name: string;
  opponent_name: string;
};

export async function getManagerBets(managerId: number): Promise<BetHistoryRow[]> {
  const { rows } = await getPool().query(
    `SELECT b.id, b.amount, b.odds, b.status, b.payout, b.placed_at,
            wl.season, wl.week, wl.spread, wl.team_a_id,
            side.display_name AS side_name,
            CASE WHEN b.side_manager_id = wl.team_a_id THEN mb.display_name ELSE ma.display_name END AS opponent_name
     FROM bets b
     JOIN weekly_lines wl ON wl.id = b.line_id
     JOIN managers side ON side.id = b.side_manager_id
     JOIN managers ma ON ma.id = wl.team_a_id
     JOIN managers mb ON mb.id = wl.team_b_id
     WHERE b.manager_id = $1
     ORDER BY b.placed_at DESC`,
    [managerId]
  );
  return rows;
}

export type LeaderboardRow = {
  manager_id: number;
  display_name: string;
  bets_placed: number;
  wins: number;
  losses: number;
  pushes: number;
  net: number;
};

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const { rows } = await getPool().query(
    `SELECT m.id AS manager_id, m.display_name,
            COUNT(b.id) AS bets_placed,
            COUNT(*) FILTER (WHERE b.status = 'won') AS wins,
            COUNT(*) FILTER (WHERE b.status = 'lost') AS losses,
            COUNT(*) FILTER (WHERE b.status = 'push') AS pushes,
            COALESCE(SUM(CASE
              WHEN b.status = 'won' THEN b.payout - b.amount
              WHEN b.status = 'lost' THEN -b.amount
              ELSE 0
            END), 0) AS net
     FROM managers m
     LEFT JOIN bets b ON b.manager_id = m.id AND b.status != 'pending'
     GROUP BY m.id, m.display_name
     ORDER BY net DESC`
  );
  return rows;
}
