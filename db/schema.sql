-- Crackyard Sportsbook — betting on weekly ESPN fantasy projections

CREATE TABLE IF NOT EXISTS managers (
    id            SERIAL PRIMARY KEY,
    espn_team_id  INTEGER NOT NULL,        -- current-season ESPN team id
    display_name  TEXT NOT NULL,
    team_name     TEXT NOT NULL,
    pin           TEXT,                    -- 4-digit PIN, set on first login; NULL = not claimed yet
    UNIQUE (espn_team_id)
);

-- ALTER for existing databases (the CREATE TABLE above only fires on a
-- brand-new install; this schema file is re-run against the live DB too).
ALTER TABLE managers ADD COLUMN IF NOT EXISTS pin TEXT;

-- One row per real matchup per week. Spread is always relative to team_a:
-- positive spread means team_a is the underdog (getting points), negative
-- means team_a is favored (giving points). team_b's number is just -spread.
CREATE TABLE IF NOT EXISTS weekly_lines (
    id              SERIAL PRIMARY KEY,
    season          INTEGER NOT NULL,
    week            INTEGER NOT NULL,
    team_a_id       INTEGER NOT NULL REFERENCES managers(id),
    team_b_id       INTEGER NOT NULL REFERENCES managers(id),
    proj_a          NUMERIC(6,2) NOT NULL,   -- snapshot at lock time
    proj_b          NUMERIC(6,2) NOT NULL,
    spread          NUMERIC(5,1) NOT NULL,   -- relative to team_a, see above
    odds            INTEGER NOT NULL DEFAULT -110,
    status          TEXT NOT NULL DEFAULT 'open', -- open | locked | final
    actual_a        NUMERIC(6,2),
    actual_b        NUMERIC(6,2),
    locked_at       TIMESTAMPTZ,
    settled_at      TIMESTAMPTZ,
    UNIQUE (season, week, team_a_id, team_b_id)
);

CREATE TABLE IF NOT EXISTS bets (
    id              SERIAL PRIMARY KEY,
    manager_id      INTEGER NOT NULL REFERENCES managers(id),  -- bettor
    line_id         INTEGER NOT NULL REFERENCES weekly_lines(id),
    side_manager_id INTEGER NOT NULL REFERENCES managers(id),  -- who they bet on
    amount          NUMERIC(6,2) NOT NULL CHECK (amount > 0),
    odds            INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | won | lost | push
    payout          NUMERIC(6,2),             -- total returned (stake + profit), set on settle
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS parlays (
    id          SERIAL PRIMARY KEY,
    manager_id  INTEGER NOT NULL REFERENCES managers(id),  -- bettor
    amount      NUMERIC(6,2) NOT NULL CHECK (amount > 0),
    status      TEXT NOT NULL DEFAULT 'pending', -- pending | won | lost | push
    payout      NUMERIC(8,2),
    placed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at  TIMESTAMPTZ
);

-- One row per leg. A leg's own status tracks its individual grade (a push
-- here doesn't push the whole parlay — it just drops out of the payout
-- calc); the parent parlay only settles once every leg has a non-pending
-- status.
CREATE TABLE IF NOT EXISTS parlay_legs (
    id              SERIAL PRIMARY KEY,
    parlay_id       INTEGER NOT NULL REFERENCES parlays(id) ON DELETE CASCADE,
    line_id         INTEGER NOT NULL REFERENCES weekly_lines(id),
    side_manager_id INTEGER NOT NULL REFERENCES managers(id),
    odds            INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | won | lost | push
    UNIQUE (parlay_id, line_id)
);

-- House-managed adjustments to a manager's weekly allowance (bonus credit
-- or a penalty), on top of the flat per-week base. Positive = added,
-- negative = deducted. Kept as a ledger (not a mutated balance field) so
-- there's an audit trail of who adjusted what and why.
CREATE TABLE IF NOT EXISTS balance_adjustments (
    id          SERIAL PRIMARY KEY,
    manager_id  INTEGER NOT NULL REFERENCES managers(id),
    season      INTEGER NOT NULL,
    week        INTEGER NOT NULL,
    amount      NUMERIC(6,2) NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lines_season_week ON weekly_lines(season, week);
CREATE INDEX IF NOT EXISTS idx_bets_manager ON bets(manager_id);
CREATE INDEX IF NOT EXISTS idx_bets_line ON bets(line_id);
CREATE INDEX IF NOT EXISTS idx_parlays_manager ON parlays(manager_id);
CREATE INDEX IF NOT EXISTS idx_parlay_legs_parlay ON parlay_legs(parlay_id);
CREATE INDEX IF NOT EXISTS idx_parlay_legs_line ON parlay_legs(line_id);
CREATE INDEX IF NOT EXISTS idx_balance_adj_manager_week ON balance_adjustments(manager_id, season, week);
