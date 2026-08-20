"""
Pull all historical data for an ESPN fantasy football league into SQLite.

Usage:
    python scripts/fetch_espn_data.py [--start 2021] [--end 2026]

Requires ESPN_LEAGUE_ID, ESPN_S2, ESPN_SWID in .env (see .env.example).
"""
import argparse
import os
import sqlite3
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

LEAGUE_ID = os.environ["ESPN_LEAGUE_ID"]
COOKIES = {"espn_s2": os.environ["ESPN_S2"], "SWID": os.environ["ESPN_SWID"]}
BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{league_id}"
PLAYERS_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/players"
DB_PATH = ROOT / "fantasyfootball.db"
SCHEMA_PATH = ROOT / "scripts" / "schema.sql"


def fetch_league(season: int) -> dict:
    url = BASE.format(season=season, league_id=LEAGUE_ID)
    params = [
        ("view", "mTeam"),
        ("view", "mStandings"),
        ("view", "mMatchupScore"),
        ("view", "mDraftDetail"),
        ("view", "mSettings"),
    ]
    r = requests.get(url, params=params, cookies=COOKIES, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_boxscore(season: int, week: int) -> dict:
    url = BASE.format(season=season, league_id=LEAGUE_ID)
    params = {"view": "mBoxscore", "scoringPeriodId": week}
    r = requests.get(url, params=params, cookies=COOKIES, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_players(season: int) -> list[dict]:
    url = PLAYERS_URL.format(season=season)
    headers = {"X-Fantasy-Filter": '{"players":{"limit":20000}}'}
    r = requests.get(url, params={"scoringPeriodId": 0, "view": "players_wl"}, cookies=COOKIES, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()


def init_db(conn: sqlite3.Connection):
    conn.executescript(SCHEMA_PATH.read_text())


def upsert_members(conn, data: dict):
    for m in data.get("members", []):
        conn.execute(
            """INSERT INTO members (member_id, display_name, first_name, last_name)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(member_id) DO UPDATE SET
                 display_name=excluded.display_name,
                 first_name=excluded.first_name,
                 last_name=excluded.last_name""",
            (m["id"], m.get("displayName"), m.get("firstName"), m.get("lastName")),
        )


def upsert_teams(conn, season: int, data: dict):
    for t in data.get("teams", []):
        rec = t.get("record", {}).get("overall", {})
        conn.execute(
            """INSERT INTO teams (season, team_id, name, abbrev, primary_owner, logo,
                                   playoff_seed, final_rank, wins, losses, ties, points_for, points_against)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(season, team_id) DO UPDATE SET
                 name=excluded.name, abbrev=excluded.abbrev, primary_owner=excluded.primary_owner,
                 logo=excluded.logo, playoff_seed=excluded.playoff_seed, final_rank=excluded.final_rank,
                 wins=excluded.wins, losses=excluded.losses, ties=excluded.ties,
                 points_for=excluded.points_for, points_against=excluded.points_against""",
            (
                season, t["id"], t.get("name"), t.get("abbrev"), t.get("primaryOwner"), t.get("logo"),
                t.get("playoffSeed"), t.get("rankCalculatedFinal"),
                rec.get("wins"), rec.get("losses"), rec.get("ties"),
                rec.get("pointsFor"), rec.get("pointsAgainst"),
            ),
        )


def upsert_matchups(conn, season: int, data: dict):
    for m in data.get("schedule", []):
        home, away = m.get("home", {}), m.get("away", {})
        conn.execute(
            """INSERT INTO matchups (season, matchup_id, week, home_team_id, home_score,
                                      away_team_id, away_score, winner, playoff_tier_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(season, matchup_id) DO UPDATE SET
                 week=excluded.week, home_team_id=excluded.home_team_id, home_score=excluded.home_score,
                 away_team_id=excluded.away_team_id, away_score=excluded.away_score,
                 winner=excluded.winner, playoff_tier_type=excluded.playoff_tier_type""",
            (
                season, m["id"], m.get("matchupPeriodId"),
                home.get("teamId"), home.get("totalPoints"),
                away.get("teamId"), away.get("totalPoints"),
                m.get("winner"), m.get("playoffTierType"),
            ),
        )


def upsert_draft_picks(conn, season: int, data: dict):
    for p in data.get("draftDetail", {}).get("picks", []):
        conn.execute(
            """INSERT INTO draft_picks (season, overall_pick, round_id, round_pick, team_id,
                                         player_id, member_id, bid_amount, keeper)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(season, overall_pick) DO UPDATE SET
                 round_id=excluded.round_id, round_pick=excluded.round_pick, team_id=excluded.team_id,
                 player_id=excluded.player_id, member_id=excluded.member_id,
                 bid_amount=excluded.bid_amount, keeper=excluded.keeper""",
            (
                season, p["overallPickNumber"], p.get("roundId"), p.get("roundPickNumber"),
                p.get("teamId"), p.get("playerId"), p.get("memberId"),
                p.get("bidAmount"), int(bool(p.get("keeper"))),
            ),
        )


def upsert_players(conn, players: list[dict]):
    for pl in players:
        conn.execute(
            """INSERT INTO players (player_id, full_name, position_id, pro_team_id)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(player_id) DO UPDATE SET
                 full_name=excluded.full_name, position_id=excluded.position_id, pro_team_id=excluded.pro_team_id""",
            (pl["id"], pl.get("fullName"), pl.get("defaultPositionId"), pl.get("proTeamId")),
        )


def upsert_boxscore(conn, season: int, week: int, data: dict):
    for m in data.get("schedule", []):
        if m.get("matchupPeriodId") != week:
            continue
        for side in ("home", "away"):
            team = m.get(side)
            if not team:
                continue
            roster = team.get("rosterForCurrentScoringPeriod") or {}
            for entry in roster.get("entries", []):
                ppe = entry.get("playerPoolEntry", {})
                conn.execute(
                    """INSERT INTO player_weekly_scores (season, week, team_id, player_id, lineup_slot_id, points)
                       VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT(season, week, team_id, player_id) DO UPDATE SET
                         lineup_slot_id=excluded.lineup_slot_id, points=excluded.points""",
                    (
                        season, week, team.get("teamId"), entry.get("playerId"),
                        entry.get("lineupSlotId"), ppe.get("appliedStatTotal"),
                    ),
                )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=2021)
    ap.add_argument("--end", type=int, default=2026)
    args = ap.parse_args()

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    for season in range(args.start, args.end + 1):
        print(f"Fetching season {season}...")
        try:
            data = fetch_league(season)
        except requests.HTTPError as e:
            print(f"  skip {season}: {e}")
            continue

        upsert_members(conn, data)
        upsert_teams(conn, season, data)
        upsert_matchups(conn, season, data)
        n_picks = len(data.get("draftDetail", {}).get("picks", []))
        if n_picks:
            upsert_draft_picks(conn, season, data)
            try:
                players = fetch_players(season)
                upsert_players(conn, players)
                print(f"  {len(data.get('teams', []))} teams, {len(data.get('schedule', []))} matchups, "
                      f"{n_picks} draft picks, {len(players)} players indexed")
            except requests.HTTPError as e:
                print(f"  players fetch failed for {season}: {e}")
        else:
            print(f"  {len(data.get('teams', []))} teams, {len(data.get('schedule', []))} matchups, "
                  f"no draft yet (preseason)")

        conn.commit()

        played_weeks = sorted({
            m["matchupPeriodId"] for m in data.get("schedule", [])
            if m.get("home", {}).get("totalPoints", 0) + m.get("away", {}).get("totalPoints", 0) > 0
        })
        if played_weeks:
            print(f"  pulling box scores for {len(played_weeks)} weeks...")
            for week in played_weeks:
                try:
                    box = fetch_boxscore(season, week)
                    upsert_boxscore(conn, season, week, box)
                except requests.HTTPError as e:
                    print(f"    week {week} boxscore failed: {e}")
                time.sleep(0.3)
            conn.commit()

        time.sleep(0.5)  # be polite to ESPN's API

    conn.close()

    import apply_identity_overrides
    apply_identity_overrides.main()

    print(f"\nDone. Database at {DB_PATH}")


if __name__ == "__main__":
    main()
