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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await syncSeason(SEASON);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Vercel Cron issues GET requests to the configured path.
export async function GET(req: NextRequest) {
  return POST(req);
}
