import { getPool } from "./pg";
import { computeLine, gradeSide, profitForOdds, parlayPayout, DEFAULT_ODDS } from "./betting";
import { fetchLeagueLive, type EspnTeam } from "./espn";
import { WEEKLY_ALLOWANCE, MIN_BET, MIN_PARLAY_LEGS } from "./bettingConstants";
import { spinReels, gradeSpin, SLOT_EMOJI, isValidSlotBet, type SlotSymbol } from "./slots";

export { WEEKLY_ALLOWANCE, MIN_BET, MIN_PARLAY_LEGS };

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

// ---- Per-manager PIN identity ----
// A manager's first login claims their name by setting a PIN; every login
// after that requires it. This is what actually stops one player from
// picking another player's name and betting as them — the old picker just
// wrote an unsigned cookie client-side with no check at all.

export async function getManagerHasPin(managerId: number): Promise<boolean> {
  const { rows } = await getPool().query(`SELECT pin FROM managers WHERE id=$1`, [managerId]);
  return rows[0]?.pin != null;
}

export type IdentityLoginResult = { ok: true } | { ok: false; error: string };

export async function loginOrClaimPin(
  managerId: number,
  pin: string,
  confirmPin?: string
): Promise<IdentityLoginResult> {
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN must be 4 digits." };

  const { rows } = await getPool().query(`SELECT pin FROM managers WHERE id=$1`, [managerId]);
  if (!rows[0]) return { ok: false, error: "Manager not found." };
  const existingPin: string | null = rows[0].pin;

  if (existingPin == null) {
    if (pin !== confirmPin) return { ok: false, error: "PINs don't match." };
    await getPool().query(`UPDATE managers SET pin=$1 WHERE id=$2`, [pin, managerId]);
    return { ok: true };
  }

  if (existingPin !== pin) return { ok: false, error: "Incorrect PIN." };
  return { ok: true };
}

// House-only: clears a manager's PIN so they can claim it again with a new
// one, for when someone forgets theirs.
export async function resetManagerPin(managerId: number): Promise<AdminResult> {
  await getPool().query(`UPDATE managers SET pin=NULL WHERE id=$1`, [managerId]);
  return { ok: true };
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

  const { rows: legs } = await pool.query(
    `SELECT * FROM parlay_legs WHERE line_id=$1 AND status='pending'`,
    [lineId]
  );
  for (const leg of legs) {
    const side = leg.side_manager_id === line.team_a_id ? "a" : "b";
    const outcome = gradeSide(actualA, actualB, spreadA, side);
    await pool.query(`UPDATE parlay_legs SET status=$1 WHERE id=$2`, [outcome, leg.id]);
    await tryFinalizeParlay(leg.parlay_id);
  }

  await pool.query(`UPDATE weekly_lines SET settled_at=now() WHERE id=$1`, [lineId]);
}

// A parlay settles once every leg has a non-pending status. A leg that
// pushed is dropped from the payout calc rather than voiding the whole
// parlay (standard sportsbook treatment); if every leg pushed, the whole
// parlay pushes.
async function tryFinalizeParlay(parlayId: number) {
  const pool = getPool();
  const { rows: legs } = await pool.query(`SELECT * FROM parlay_legs WHERE parlay_id=$1`, [parlayId]);
  if (legs.some((l) => l.status === "pending")) return;

  const { rows: parlayRows } = await pool.query(`SELECT * FROM parlays WHERE id=$1`, [parlayId]);
  const parlay = parlayRows[0];
  if (!parlay || parlay.status !== "pending") return;

  const amount = Number(parlay.amount);
  let status: "won" | "lost" | "push";
  let payout: number;

  if (legs.some((l) => l.status === "lost")) {
    status = "lost";
    payout = 0;
  } else {
    const liveLegOdds = legs.filter((l) => l.status === "won").map((l) => l.odds);
    if (liveLegOdds.length === 0) {
      status = "push"; // every leg pushed
      payout = amount;
    } else {
      status = "won";
      payout = parlayPayout(amount, liveLegOdds) ?? amount;
    }
  }

  await pool.query(
    `UPDATE parlays SET status=$1, payout=$2, settled_at=now() WHERE id=$3`,
    [status, payout, parlayId]
  );
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

// House-managed bonus/penalty to a manager's weekly CREDIT, on top of the
// flat WEEKLY_ALLOWANCE base — this never touches the displayed Balance,
// only what's available to bet with (see getManagerWeekMoney).
export async function getManagerWeekAdjustment(managerId: number, season: number, week: number): Promise<number> {
  const { rows } = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM balance_adjustments
     WHERE manager_id = $1 AND season = $2 AND week = $3`,
    [managerId, season, week]
  );
  return Number(rows[0].total);
}

// House-only correction to a manager's weekly BALANCE — the only writer
// is resetManagerWeekBalance. Kept as its own ledger, separate from
// balance_adjustments, so a credit bonus/penalty can never accidentally
// move Balance and vice versa.
async function getManagerWeekBalanceCorrection(managerId: number, season: number, week: number): Promise<number> {
  const { rows } = await getPool().query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM balance_corrections
     WHERE manager_id = $1 AND season = $2 AND week = $3`,
    [managerId, season, week]
  );
  return Number(rows[0].total);
}

export type ManagerWeekMoney = {
  balance: number;
  pendingAtRisk: number;
  credit: number;
};

// Splits a manager's week into two numbers instead of one flat allowance:
//   - balance: what you've actually won or lost this week — net
//     profit/loss from settled bets (won/lost/push) plus any house
//     "Reset Balance" correction. Starts at 0 each week; can go
//     negative. This is deliberately NOT affected by the "Adjust"
//     column's credit adjustment — the only way to move Balance is
//     resetManagerWeekBalance.
//   - credit: what's actually available to place new bets with right
//     now — the base allowance plus any credit adjustment plus balance,
//     minus whatever's currently tied up in pending bets. Floored at 0,
//     but goes back up above the starting allowance as bets win, since
//     a win frees up more than the stake that was risked.
// A parlay's legs are always drawn from whatever week is currently open
// (only one week is ever open at a time), so checking any one leg's week
// is enough to attribute the whole parlay to it. Cancelled bets/parlays
// count toward neither figure — the house voiding one means that money
// was never really at risk and never really won or lost.
export async function getManagerWeekMoney(managerId: number, season: number, week: number): Promise<ManagerWeekMoney> {
  const [adjustment, correction, { rows }] = await Promise.all([
    getManagerWeekAdjustment(managerId, season, week),
    getManagerWeekBalanceCorrection(managerId, season, week),
    getPool().query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_at_risk,
         COALESCE(SUM(CASE
           WHEN status = 'won' THEN payout - amount
           WHEN status = 'lost' THEN -amount
           WHEN status = 'spin' THEN payout - amount
           ELSE 0
         END), 0) AS settled_net
       FROM (
         SELECT b.amount, b.status, b.payout FROM bets b JOIN weekly_lines wl ON wl.id = b.line_id
         WHERE b.manager_id = $1 AND wl.season = $2 AND wl.week = $3 AND b.status != 'cancelled'
         UNION ALL
         SELECT p.amount, p.status, p.payout FROM parlays p
         WHERE p.manager_id = $1 AND p.status != 'cancelled' AND EXISTS (
           SELECT 1 FROM parlay_legs pl JOIN weekly_lines wl ON wl.id = pl.line_id
           WHERE pl.parlay_id = p.id AND wl.season = $2 AND wl.week = $3
         )
         UNION ALL
         -- Slot spins resolve instantly, so they only ever land in
         -- balance, never pending_at_risk — there's no in-between state.
         -- Always tagged 'spin' (not won/lost/push) so its balance
         -- contribution is always payout - amount, which is correct for
         -- every outcome including a partial return like two-of-a-kind's
         -- half-back — unlike bets/parlays, a spin's payout isn't always
         -- either 0 or the full stake.
         SELECT s.amount, 'spin', s.payout
         FROM slot_spins s
         WHERE s.manager_id = $1 AND s.season = $2 AND s.week = $3
       ) combined`,
      [managerId, season, week]
    ),
  ]);
  const pendingAtRisk = Number(rows[0].pending_at_risk);
  const balance = Number(rows[0].settled_net) + correction;
  const credit = Math.max(0, WEEKLY_ALLOWANCE + adjustment + balance - pendingAtRisk);
  return { balance, pendingAtRisk, credit };
}

// Zeroes out a manager's balance for the week by inserting a
// balance_corrections row for exactly -balance. This is the only
// function that writes to balance_corrections — the "Adjust" column's
// credit bonus/penalty lives in the separate balance_adjustments table
// and never affects Balance.
export async function resetManagerWeekBalance(managerId: number, season: number, week: number): Promise<AdminResult> {
  const { balance } = await getManagerWeekMoney(managerId, season, week);
  if (Math.abs(balance) < 0.005) return { ok: true };
  await getPool().query(
    `INSERT INTO balance_corrections (manager_id, season, week, amount, note) VALUES ($1, $2, $3, $4, $5)`,
    [managerId, season, week, -balance, "Balance reset by house"]
  );
  return { ok: true };
}

export type SlotSpinResult =
  | { ok: true; reels: SlotSymbol[]; amount: number; payout: number; credit: number; balance: number }
  | { ok: false; error: string };

// Every pull is picked in 50-cent tokens (SLOT_MIN_BET..SLOT_MAX_BET) —
// isValidSlotBet rejects anything off that grid before it's trusted, same
// never-trust-the-client posture as placeBet/placeParlay's amount checks.
// A spin settles in the same call that places it — no pending state.
export async function playSlotSpin(
  managerId: number,
  season: number,
  week: number,
  amount: number
): Promise<SlotSpinResult> {
  if (!isValidSlotBet(amount)) {
    return { ok: false, error: "Invalid pull amount." };
  }
  const { credit } = await getManagerWeekMoney(managerId, season, week);
  if (amount > credit + 1e-9) {
    return { ok: false, error: `Only $${credit.toFixed(2)} of credit left this week.` };
  }

  const reels = spinReels();
  const payout = gradeSpin(reels, amount);

  await getPool().query(
    `INSERT INTO slot_spins (manager_id, season, week, amount, payout, reels)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [managerId, season, week, amount, payout, reels.map((r) => SLOT_EMOJI[r]).join(",")]
  );

  const after = await getManagerWeekMoney(managerId, season, week);
  return { ok: true, reels, amount, payout, credit: after.credit, balance: after.balance };
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

  const { credit } = await getManagerWeekMoney(managerId, line.season, line.week);
  if (amount > credit + 1e-9) {
    return { ok: false, error: `Only $${credit.toFixed(2)} of credit left this week.` };
  }

  const { rows } = await getPool().query(
    `INSERT INTO bets (manager_id, line_id, side_manager_id, amount, odds)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [managerId, lineId, sideManagerId, amount, line.odds]
  );
  return { ok: true, betId: rows[0].id };
}

export type ParlayLegInput = { lineId: number; sideManagerId: number };

export type PlaceParlayResult =
  | { ok: true; parlayId: number }
  | { ok: false; error: string };

export async function placeParlay(
  managerId: number,
  legs: ParlayLegInput[],
  amount: number
): Promise<PlaceParlayResult> {
  if (amount < MIN_BET) return { ok: false, error: `Minimum bet is $${MIN_BET}.` };
  if (legs.length < MIN_PARLAY_LEGS) {
    return { ok: false, error: `A parlay needs at least ${MIN_PARLAY_LEGS} legs.` };
  }
  const lineIds = legs.map((l) => l.lineId);
  if (new Set(lineIds).size !== lineIds.length) {
    return { ok: false, error: "Can't parlay two picks from the same matchup." };
  }

  const pool = getPool();
  const { rows: lineRows } = await pool.query(
    `SELECT * FROM weekly_lines WHERE id = ANY($1::int[])`,
    [lineIds]
  );
  const linesById = new Map<number, LineRow>(lineRows.map((r) => [r.id, r]));

  for (const leg of legs) {
    const line = linesById.get(leg.lineId);
    if (!line) return { ok: false, error: "One of the selected lines no longer exists." };
    if (line.status !== "open") return { ok: false, error: "One of the selected lines is no longer open." };
    if (leg.sideManagerId !== line.team_a_id && leg.sideManagerId !== line.team_b_id) {
      return { ok: false, error: "Invalid side on one of the legs." };
    }
    if (managerId === line.team_a_id || managerId === line.team_b_id) {
      return { ok: false, error: "You can't include your own matchup in a parlay." };
    }
  }

  const firstLine = linesById.get(legs[0].lineId)!;
  const { credit } = await getManagerWeekMoney(managerId, firstLine.season, firstLine.week);
  if (amount > credit + 1e-9) {
    return { ok: false, error: `Only $${credit.toFixed(2)} of credit left this week.` };
  }

  const { rows: parlayRows } = await pool.query(
    `INSERT INTO parlays (manager_id, amount) VALUES ($1, $2) RETURNING id`,
    [managerId, amount]
  );
  const parlayId = parlayRows[0].id;

  for (const leg of legs) {
    const line = linesById.get(leg.lineId)!;
    await pool.query(
      `INSERT INTO parlay_legs (parlay_id, line_id, side_manager_id, odds) VALUES ($1, $2, $3, $4)`,
      [parlayId, leg.lineId, leg.sideManagerId, line.odds]
    );
  }

  return { ok: true, parlayId };
}

export type ParlayHistoryRow = {
  id: number;
  amount: string;
  status: string;
  payout: string | null;
  placed_at: string;
  legs: {
    line_id: number;
    side_name: string;
    opponent_name: string;
    spread_for_side: string;
    odds: number;
    status: string;
    season: number;
    week: number;
  }[];
};

export async function getManagerParlays(managerId: number): Promise<ParlayHistoryRow[]> {
  const { rows: parlays } = await getPool().query(
    `SELECT id, amount, status, payout, placed_at FROM parlays WHERE manager_id=$1 ORDER BY placed_at DESC`,
    [managerId]
  );
  if (parlays.length === 0) return [];

  const { rows: legs } = await getPool().query(
    `SELECT pl.parlay_id, pl.line_id, pl.odds, pl.status, wl.season, wl.week,
            side.display_name AS side_name,
            CASE WHEN pl.side_manager_id = wl.team_a_id THEN mb.display_name ELSE ma.display_name END AS opponent_name,
            CASE WHEN pl.side_manager_id = wl.team_a_id THEN wl.spread ELSE -wl.spread END AS spread_for_side
     FROM parlay_legs pl
     JOIN weekly_lines wl ON wl.id = pl.line_id
     JOIN managers side ON side.id = pl.side_manager_id
     JOIN managers ma ON ma.id = wl.team_a_id
     JOIN managers mb ON mb.id = wl.team_b_id
     WHERE pl.parlay_id = ANY($1::int[])
     ORDER BY pl.id`,
    [parlays.map((p) => p.id)]
  );

  return parlays.map((p) => ({
    ...p,
    legs: legs.filter((l) => l.parlay_id === p.id),
  }));
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
    `WITH wagers AS (
       SELECT manager_id, status, amount, payout FROM bets WHERE status NOT IN ('pending', 'cancelled')
       UNION ALL
       SELECT manager_id, status, amount, payout FROM parlays WHERE status NOT IN ('pending', 'cancelled')
     )
     SELECT m.id AS manager_id, m.display_name,
            COUNT(w.*) AS bets_placed,
            COUNT(*) FILTER (WHERE w.status = 'won') AS wins,
            COUNT(*) FILTER (WHERE w.status = 'lost') AS losses,
            COUNT(*) FILTER (WHERE w.status = 'push') AS pushes,
            COALESCE(SUM(CASE
              WHEN w.status = 'won' THEN w.payout - w.amount
              WHEN w.status = 'lost' THEN -w.amount
              ELSE 0
            END), 0) AS net
     FROM managers m
     LEFT JOIN wagers w ON w.manager_id = m.id
     GROUP BY m.id, m.display_name
     ORDER BY net DESC`
  );
  return rows;
}

// ---- House/admin operations ----

export type AdminResult = { ok: true } | { ok: false; error: string };

// Cancelling only makes sense for a bet/parlay that hasn't settled yet —
// once it's won/lost/pushed the outcome already happened.
export async function cancelBet(betId: number): Promise<AdminResult> {
  const { rows } = await getPool().query(`SELECT status FROM bets WHERE id=$1`, [betId]);
  if (!rows[0]) return { ok: false, error: "Bet not found." };
  if (rows[0].status !== "pending") return { ok: false, error: "Only a pending bet can be cancelled." };
  await getPool().query(`UPDATE bets SET status='cancelled' WHERE id=$1`, [betId]);
  return { ok: true };
}

export async function cancelParlay(parlayId: number): Promise<AdminResult> {
  const { rows } = await getPool().query(`SELECT status FROM parlays WHERE id=$1`, [parlayId]);
  if (!rows[0]) return { ok: false, error: "Parlay not found." };
  if (rows[0].status !== "pending") return { ok: false, error: "Only a pending parlay can be cancelled." };
  const pool = getPool();
  await pool.query(`UPDATE parlays SET status='cancelled' WHERE id=$1`, [parlayId]);
  await pool.query(`UPDATE parlay_legs SET status='cancelled' WHERE parlay_id=$1`, [parlayId]);
  return { ok: true };
}

export async function adjustBalance(
  managerId: number,
  season: number,
  week: number,
  amount: number,
  note: string
): Promise<AdminResult> {
  if (!amount) return { ok: false, error: "Amount can't be zero." };
  await getPool().query(
    `INSERT INTO balance_adjustments (manager_id, season, week, amount, note) VALUES ($1, $2, $3, $4, $5)`,
    [managerId, season, week, amount, note || null]
  );
  return { ok: true };
}

export type ManagerWeekSummary = {
  manager_id: number;
  display_name: string;
  adjustment: number;
  balance: number;
  credit: number;
};

export async function getAllManagerWeekSummaries(season: number, week: number): Promise<ManagerWeekSummary[]> {
  const managers = await getManagers();
  return Promise.all(
    managers.map(async (m) => {
      const [money, adjustment] = await Promise.all([
        getManagerWeekMoney(m.id, season, week),
        getManagerWeekAdjustment(m.id, season, week),
      ]);
      return {
        manager_id: m.id,
        display_name: m.display_name,
        adjustment,
        balance: money.balance,
        credit: money.credit,
      };
    })
  );
}

export type AdminBetRow = {
  id: number;
  manager_name: string;
  side_name: string;
  opponent_name: string;
  spread_for_side: string;
  amount: string;
  odds: number;
  status: string;
  payout: string | null;
  week: number;
};

export async function getAllBetsForWeek(season: number, week: number): Promise<AdminBetRow[]> {
  const { rows } = await getPool().query(
    `SELECT b.id, bettor.display_name AS manager_name, side.display_name AS side_name,
            CASE WHEN b.side_manager_id = wl.team_a_id THEN mb.display_name ELSE ma.display_name END AS opponent_name,
            CASE WHEN b.side_manager_id = wl.team_a_id THEN wl.spread ELSE -wl.spread END AS spread_for_side,
            b.amount, b.odds, b.status, b.payout, wl.week
     FROM bets b
     JOIN weekly_lines wl ON wl.id = b.line_id
     JOIN managers bettor ON bettor.id = b.manager_id
     JOIN managers side ON side.id = b.side_manager_id
     JOIN managers ma ON ma.id = wl.team_a_id
     JOIN managers mb ON mb.id = wl.team_b_id
     WHERE wl.season = $1 AND wl.week = $2
     ORDER BY b.placed_at DESC`,
    [season, week]
  );
  return rows;
}

export type AdminParlayRow = {
  id: number;
  manager_name: string;
  amount: string;
  status: string;
  payout: string | null;
  legs: { side_name: string; opponent_name: string; spread_for_side: string; odds: number; status: string; week: number }[];
};

export async function getAllParlaysForWeek(season: number, week: number): Promise<AdminParlayRow[]> {
  const { rows: parlays } = await getPool().query(
    `SELECT DISTINCT p.id, bettor.display_name AS manager_name, p.amount, p.status, p.payout, p.placed_at
     FROM parlays p
     JOIN managers bettor ON bettor.id = p.manager_id
     JOIN parlay_legs pl ON pl.parlay_id = p.id
     JOIN weekly_lines wl ON wl.id = pl.line_id
     WHERE wl.season = $1 AND wl.week = $2
     ORDER BY p.placed_at DESC`,
    [season, week]
  );
  if (parlays.length === 0) return [];

  const { rows: legs } = await getPool().query(
    `SELECT pl.parlay_id, pl.odds, pl.status, wl.week,
            side.display_name AS side_name,
            CASE WHEN pl.side_manager_id = wl.team_a_id THEN mb.display_name ELSE ma.display_name END AS opponent_name,
            CASE WHEN pl.side_manager_id = wl.team_a_id THEN wl.spread ELSE -wl.spread END AS spread_for_side
     FROM parlay_legs pl
     JOIN weekly_lines wl ON wl.id = pl.line_id
     JOIN managers side ON side.id = pl.side_manager_id
     JOIN managers ma ON ma.id = wl.team_a_id
     JOIN managers mb ON mb.id = wl.team_b_id
     WHERE pl.parlay_id = ANY($1::int[])
     ORDER BY pl.id`,
    [parlays.map((p) => p.id)]
  );

  return parlays.map((p) => ({
    ...p,
    legs: legs.filter((l) => l.parlay_id === p.id),
  }));
}
