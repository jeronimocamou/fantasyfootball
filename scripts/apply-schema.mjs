import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const sql = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");
const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
console.log("Schema applied.");
await client.end();
