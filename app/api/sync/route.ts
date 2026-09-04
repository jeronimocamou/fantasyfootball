import { NextRequest, NextResponse } from "next/server";
import { syncSeason } from "@/lib/queries";

const SEASON = 2026;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured, open (fine for local dev)

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
  // when a CRON_SECRET env var is set on the project. Manual calls can use
  // ?secret= or an X-Sync-Secret header with the same value.
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const header = req.headers.get("x-sync-secret");
  const query = new URL(req.url).searchParams.get("secret");
  return header === secret || query === secret;
}

async function runSync(): Promise<NextResponse> {
  try {
    await syncSeason(SEASON);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

// vercel.json fires this cron at two fixed UTC times, one an hour apart
// from the other — a single UTC slot would land on 8:30pm Eastern for
// only half the season and drift to 7:30 or 9:30 once the US clock
// changes for DST. Rather than hand-editing the schedule again every
// November/March, both slots fire every day and this checks which one
// (if either) is actually 8:30pm Eastern right now; the other is a
// harmless no-op.
function isEightThirtyEastern(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour === 20 && minute >= 25 && minute <= 35;
}

// Vercel Cron issues GET requests to the configured path.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEightThirtyEastern()) {
    return NextResponse.json({ ok: true, skipped: "not the active 8:30pm ET slot" });
  }
  return runSync();
}
