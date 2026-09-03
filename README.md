# Crackyard Sportsbook

A play-money sportsbook for the Crackyard fantasy football league (ESPN league `1829348794`). Every week, spreads are set from ESPN's own live projected team totals — no lines are set by hand. League members each get a weekly (non-real) credit allowance (`WEEKLY_ALLOWANCE` in `lib/bettingConstants.ts`, currently $20) to bet straight or as a parlay on any matchup they aren't personally playing in.

**Nothing here is real money.** It's a private betting-line side-game for a friend group, settled entirely in play-money credits.

## How it works

1. A sync job (`POST /api/sync`) pulls the current week's matchups from ESPN, using `totalProjectedPoints` — ESPN's own live projection, computed per team.
2. The spread is just the projected-point gap between the two teams (e.g. proj 130 vs proj 125 → the 130 team is a 5.0-point favorite). Odds are fixed at standard `-110` on both sides.
3. A line stays **open** for betting until any live scoring shows up that week (i.e. kickoff of the first game), at which point it **locks** — the projection snapshot at lock time is what settles bets, not the live-updating number.
4. Once ESPN reports a decided winner for a matchup, the line goes **final** and all pending bets on it are graded against the spread (standard against-the-spread math, including pushes) and paid out at `-110`.
5. Members "log in" by picking their name from a dropdown, then a 4-digit PIN — the first time picking a name claims it with a PIN of your choosing, every login after that requires it. This is what actually stops one player from betting as another; the session cookie is server-signed (`lib/session.ts`), not just a plain value the client could set itself.

## Stack

- Next.js 16 (App Router), Postgres (Vercel Postgres / Neon)
- `lib/betting.ts` — pure spread/odds/grading math, no I/O
- `lib/espn.ts` — pulls live projected + actual team totals from ESPN
- `lib/queries.ts` — the sync algorithm (open → locked → final) and all bet/leaderboard queries
- `lib/identity.ts` / `identityCookie.ts` — reads/names the signed session cookie
- `lib/session.ts` — HMAC-signs a manager id into the cookie value (`SESSION_SECRET`), so it can't be forged client-side

## Setup

```bash
npm install
cp .env.example .env   # fill in ESPN_S2/ESPN_SWID (see below) and POSTGRES_URL
node scripts/apply-schema.mjs   # creates managers / weekly_lines / bets tables
```

ESPN auth (same as before): log into [fantasy.espn.com](https://fantasy.espn.com), DevTools → Application → Cookies → `https://fantasy.espn.com`, copy `espn_s2` and `SWID`.

Postgres: create a database (Vercel dashboard → Storage → Postgres, or any Neon/Postgres instance) and put its connection string in `POSTGRES_URL`.

## Running

```bash
npm run dev
curl -X POST http://localhost:3000/api/sync   # pull current week + settle any finished matchups
```

In production, `vercel.json` configures a daily cron hitting `/api/sync`. Set a `CRON_SECRET` env var to have Vercel authenticate those calls automatically (and to require the same value as `?secret=` or `X-Sync-Secret` on manual calls). Because Vercel Cron is capped at once/day on the Hobby plan, hit `/api/sync` manually around kickoff and after Monday Night Football if you want tighter lock/settle timing.

## House dashboard

`/admin` is a PIN-gated view for running the book: everyone's balances
and bets for the current week, cancelling a pending bet or parlay, and
crediting/debiting a manager's weekly allowance (kept as a ledger in
`balance_adjustments`, not a mutated balance field, so there's an audit
trail). It's a separate auth path from the casual name-picker used for
regular betting — the admin session is an httpOnly cookie set by
`POST /api/admin/login` after checking `ADMIN_PIN`, so unlike the
identity cookie it can't be forged via `document.cookie` in devtools.
Requires `ADMIN_PIN` and `ADMIN_SESSION_SECRET` to be set; without them
the login route just rejects everything.

The dashboard also has a **Reset PIN** button per manager, for anyone who
forgets theirs — it clears their PIN so the next login prompts them to
claim a new one, same as the very first time.

## Renaming managers

ESPN team names change whenever an owner renames their team; `display_name` doesn't follow automatically (by design, so a manager's identity is stable even if they rename their team). Edit `scripts/rename-managers.mjs` and re-run it to fix a name.

## Legacy: historical stats data

This repo used to host a full stats/analytics site (standings, records, draft history, luck index, etc.) built from a SQLite pull of the league's full 2021–2026 history. That UI has been replaced by the sportsbook above, but the underlying data pipeline is still here and untouched:

- `scripts/fetch_espn_data.py` — pulls full season history into `fantasyfootball.db` (SQLite)
- `scripts/apply_identity_overrides.py` — resolves ESPN's anonymized display names to real ones
- `fantasyfootball.db` — the pulled data itself

Neither is used by the live site anymore, but they're left in place in case that data or those scripts are useful again later.
