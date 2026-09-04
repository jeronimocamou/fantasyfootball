import { NextResponse } from "next/server";
import { playSlotSpin, getCurrentWeek } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";

const SEASON = 2026;

export async function POST() {
  // managerId comes from the verified session, never from the request body —
  // same reasoning as /api/bets and /api/parlays. There's no amount to read
  // from the body either: every pull costs the same fixed token.
  const managerId = await getCurrentManagerId();
  if (managerId == null) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return NextResponse.json({ ok: false, error: "No week open yet." }, { status: 400 });
  }

  const result = await playSlotSpin(managerId, SEASON, week);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
