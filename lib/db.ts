import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), "fantasyfootball.db"), {
      readonly: true,
      fileMustExist: true,
    });
  }
  return db;
}

export type Team = {
  season: number;
  team_id: number;
  name: string;
  abbrev: string;
  primary_owner: string;
  logo: string | null;
  playoff_seed: number | null;
  final_rank: number | null;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
};

export type TeamWithOwner = Team & { display_name: string };

export type Matchup = {
  season: number;
  matchup_id: number;
  week: number;
  home_team_id: number;
  home_score: number;
  away_team_id: number;
  away_score: number;
  winner: string;
  playoff_tier_type: string;
};

export type DraftPick = {
  season: number;
  overall_pick: number;
  round_id: number;
  round_pick: number;
  team_id: number;
  player_id: number;
  member_id: string | null;
  bid_amount: number;
  keeper: number;
  full_name: string | null;
  position_id: number | null;
};

export function getSeasons(): number[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT season FROM teams ORDER BY season DESC")
    .all() as { season: number }[];
  return rows.map((r) => r.season);
}

export function getTeamsForSeason(season: number): TeamWithOwner[] {
  return getDb()
    .prepare(
      `SELECT t.*, m.display_name
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.season = ?
       ORDER BY CASE WHEN t.final_rank > 0 THEN t.final_rank ELSE 999 END ASC,
                t.wins DESC, t.points_for DESC`
    )
    .all(season) as TeamWithOwner[];
}

export function getMatchupsForSeason(season: number): Matchup[] {
  return getDb()
    .prepare(
      `SELECT * FROM matchups WHERE season = ? AND home_score + away_score > 0
       ORDER BY week ASC, matchup_id ASC`
    )
    .all(season) as Matchup[];
}

export function getDraftForSeason(season: number): DraftPick[] {
  return getDb()
    .prepare(
      `SELECT d.*, p.full_name, p.position_id
       FROM draft_picks d LEFT JOIN players p ON d.player_id = p.player_id
       WHERE d.season = ? AND d.player_id != -1
       ORDER BY d.overall_pick ASC`
    )
    .all(season) as DraftPick[];
}

// All-time standings aggregated by owner (member_id), across every season they fielded a team.
export type OwnerAllTime = {
  member_id: string;
  display_name: string;
  seasons_played: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  championships: number;
};

export type LeagueSummary = {
  completedSeasons: number;
  totalGames: number;
  championshipsAwarded: number;
  reigningChampion: { season: number; team_name: string; display_name: string } | null;
};

export function getLeagueSummary(): LeagueSummary {
  const db = getDb();
  const completedSeasons = (
    db.prepare(`SELECT COUNT(DISTINCT season) AS n FROM teams WHERE wins + losses + ties > 0`).get() as {
      n: number;
    }
  ).n;
  const totalGames = (
    db.prepare(`SELECT COUNT(*) AS n FROM matchups WHERE home_score + away_score > 0`).get() as { n: number }
  ).n;
  const championshipsAwarded = (
    db.prepare(`SELECT COUNT(*) AS n FROM teams WHERE final_rank = 1`).get() as { n: number }
  ).n;
  const champ = db
    .prepare(
      `SELECT t.season, t.name AS team_name, COALESCE(m.display_name,'Unknown') AS display_name
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.final_rank = 1
       ORDER BY t.season DESC LIMIT 1`
    )
    .get() as { season: number; team_name: string; display_name: string } | undefined;

  return {
    completedSeasons,
    totalGames,
    championshipsAwarded,
    reigningChampion: champ ?? null,
  };
}

export function getAllTimeStandings(): OwnerAllTime[] {
  return getDb()
    .prepare(
      `SELECT
         t.primary_owner AS member_id,
         COALESCE(m.display_name, 'Unknown') AS display_name,
         COUNT(DISTINCT t.season) AS seasons_played,
         SUM(t.wins) AS wins,
         SUM(t.losses) AS losses,
         SUM(t.ties) AS ties,
         SUM(t.points_for) AS points_for,
         SUM(t.points_against) AS points_against,
         SUM(CASE WHEN t.final_rank = 1 THEN 1 ELSE 0 END) AS championships
       FROM teams t
       LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.primary_owner IS NOT NULL
       GROUP BY t.primary_owner
       ORDER BY wins DESC, points_for DESC`
    )
    .all() as OwnerAllTime[];
}

export type MatchupWithNames = Matchup & {
  home_name: string;
  away_name: string;
  home_owner: string;
  away_owner: string;
};

export type PointsBySeason = {
  season: number;
  member_id: string;
  display_name: string;
  points_for: number;
  wins: number;
  losses: number;
};

export function getPointsBySeason(): PointsBySeason[] {
  return getDb()
    .prepare(
      `SELECT t.season, t.primary_owner AS member_id, COALESCE(m.display_name,'Unknown') AS display_name,
              t.points_for, t.wins, t.losses
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.primary_owner IS NOT NULL AND (t.wins + t.losses + t.ties) > 0
       ORDER BY t.season ASC`
    )
    .all() as PointsBySeason[];
}

export type SeasonTeamTotal = {
  season: number;
  team_id: number;
  name: string;
  display_name: string;
  points_for: number;
  wins: number;
  losses: number;
};

export function getBestSeasonTotals(limit = 5): SeasonTeamTotal[] {
  return getDb()
    .prepare(
      `SELECT t.season, t.team_id, t.name, COALESCE(m.display_name,'Unknown') AS display_name,
              t.points_for, t.wins, t.losses
       FROM teams t LEFT JOIN members m ON t.primary_owner = m.member_id
       WHERE t.wins + t.losses + t.ties > 0
       ORDER BY t.points_for DESC LIMIT ?`
    )
    .all(limit) as SeasonTeamTotal[];
}

export function getAllMatchupsWithNames(): MatchupWithNames[] {
  return getDb()
    .prepare(
      `SELECT ms.*,
              ht.name AS home_name, hm.display_name AS home_owner,
              at.name AS away_name, am.display_name AS away_owner
       FROM matchups ms
       JOIN teams ht ON ms.season = ht.season AND ms.home_team_id = ht.team_id
       JOIN teams at ON ms.season = at.season AND ms.away_team_id = at.team_id
       LEFT JOIN members hm ON ht.primary_owner = hm.member_id
       LEFT JOIN members am ON at.primary_owner = am.member_id
       WHERE ms.home_score + ms.away_score > 0
       ORDER BY ms.season ASC, ms.week ASC`
    )
    .all() as MatchupWithNames[];
}
