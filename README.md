# Crackyard FFL Stats

Pulls historical data for ESPN Fantasy Football league `1829348794` (2021–present) into a local SQLite database, for building stats/analytics on top of.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in ESPN_S2 and ESPN_SWID (see below)
```

Your league is private, so ESPN requires two auth cookies from a logged-in browser session:

1. Log into [fantasy.espn.com](https://fantasy.espn.com) and open the league.
2. DevTools → Application/Storage → Cookies → `https://fantasy.espn.com`.
3. Copy `espn_s2` and `SWID` into `.env`.

## Pull the data

```bash
python3 scripts/fetch_espn_data.py            # all seasons, 2021-2026
python3 scripts/fetch_espn_data.py --start 2024 --end 2025   # subset
```

Re-running is safe — every table is upserted on its primary key, so it just refreshes.

## Database

SQLite file at `fantasyfootball.db`, schema in [scripts/schema.sql](scripts/schema.sql):

- **members** — league owners (stable ESPN member GUID → display name)
- **teams** — one row per team per season: name, owner, final standing, W/L/T, points for/against
- **matchups** — every regular-season and playoff matchup, per week, with scores
- **players** — NFL player ID → name/position/pro team, for resolving draft picks
- **draft_picks** — full draft board per season: pick number, team, player, keeper flag, auction bid (if applicable)

2026 rows reflect the preseason state (draft not yet played, so `draft_picks.player_id = -1` as placeholders) — rerun the script after draft day to fill them in.

## Notes

- `owners` in ESPN's API is a list of GUIDs; this schema currently keeps only `primaryOwner` on `teams`. Fine for single-manager teams; revisit if any team has co-managers you want tracked separately.
- Weekly/player-level lineups (who started/benched each week) aren't pulled yet — only final matchup scores. Add an `mBoxscore` pull per week if you want that level of detail later.
