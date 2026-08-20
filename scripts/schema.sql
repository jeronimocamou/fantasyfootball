-- Crackyard FFL (ESPN league 1829348794) — normalized SQLite schema

CREATE TABLE IF NOT EXISTS members (
    member_id    TEXT PRIMARY KEY,   -- ESPN GUID, e.g. {1B936DF8-...}
    display_name TEXT,
    first_name   TEXT,
    last_name    TEXT
);

CREATE TABLE IF NOT EXISTS teams (
    season         INTEGER NOT NULL,
    team_id        INTEGER NOT NULL,
    name           TEXT,
    abbrev         TEXT,
    primary_owner  TEXT REFERENCES members(member_id),
    logo           TEXT,
    playoff_seed   INTEGER,
    final_rank     INTEGER,          -- rankCalculatedFinal
    wins           INTEGER,
    losses         INTEGER,
    ties           INTEGER,
    points_for     REAL,
    points_against REAL,
    PRIMARY KEY (season, team_id)
);

CREATE TABLE IF NOT EXISTS matchups (
    season            INTEGER NOT NULL,
    matchup_id        INTEGER NOT NULL,
    week              INTEGER,       -- matchupPeriodId
    home_team_id      INTEGER,
    home_score        REAL,
    away_team_id      INTEGER,
    away_score        REAL,
    winner            TEXT,          -- HOME / AWAY / TIE / UNDECIDED
    playoff_tier_type TEXT,          -- NONE / WINNERS_BRACKET / LOSERS_CONSOLATION_LADDER etc
    PRIMARY KEY (season, matchup_id)
);

CREATE TABLE IF NOT EXISTS players (
    player_id     INTEGER PRIMARY KEY,
    full_name     TEXT,
    position_id   INTEGER,
    pro_team_id   INTEGER
);

CREATE TABLE IF NOT EXISTS draft_picks (
    season       INTEGER NOT NULL,
    overall_pick INTEGER NOT NULL,
    round_id     INTEGER,
    round_pick   INTEGER,
    team_id      INTEGER,
    player_id    INTEGER REFERENCES players(player_id),
    member_id    TEXT REFERENCES members(member_id),
    bid_amount   INTEGER,
    keeper       INTEGER,            -- 0/1
    PRIMARY KEY (season, overall_pick)
);

CREATE INDEX IF NOT EXISTS idx_matchups_season_week ON matchups(season, week);
CREATE INDEX IF NOT EXISTS idx_draft_season ON draft_picks(season);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(primary_owner);
