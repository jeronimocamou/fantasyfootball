import { NextRequest, NextResponse } from "next/server";
import { syncSeason, recordSyncAttempt } from "@/lib/queries";

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
    await recordSyncAttempt(null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    await recordSyncAttempt(String(err)).catch((e) => console.error("also failed to record sync status:", e));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}

// vercel.json fires this cron at two fixed UTC times, an hour apart —
// one lands near 8:30pm Eastern in EDT, the other in EST. We used to only
// actually sync on whichever slot matched the real current Eastern time,
// skipping the other as a no-op. That gate was too strict in practice:
// Vercel's cron dispatch isn't exact-to-the-minute, and a delayed
// invocation landing outside the check window meant the sync silently
// never ran at all — which is exactly what happened for over a week.
// syncSeason is fully idempotent (safe to call repeatedly — it just
// refreshes projections or advances status off live ESPN data, no
// duplicate rows), so both slots now just sync unconditionally. Worst
// case that's two real syncs a day near evening instead of one; the
// alternative was zero.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runSync();
}
