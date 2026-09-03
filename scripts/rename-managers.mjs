import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

// espn_team_id (2026 season) -> real name, matching the identity
// resolution already applied to the historical SQLite stats data.
const NAMES = {
  1: "Michael Grabel",
  2: "Jeronimo Camou",
  3: "mjester31",
  5: "logan guerrieri",
  6: "Will",
  7: "spencerp18",
  10: "Max",
  11: "jakemondschein45",
  12: "Eddie Iuteri",
  13: "Ben",
};

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
for (const [espnTeamId, name] of Object.entries(NAMES)) {
  const res = await client.query(
    `UPDATE managers SET display_name = $1 WHERE espn_team_id = $2`,
    [name, Number(espnTeamId)]
  );
  console.log(`espn_team_id ${espnTeamId} -> ${name} (${res.rowCount} row)`);
}
await client.end();
