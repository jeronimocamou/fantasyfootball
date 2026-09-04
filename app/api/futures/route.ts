import { NextRequest, NextResponse } from "next/server";
import { placeFuturesBet, getCurrentWeek } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";

const SEASON = 2026;

export async function POST(req: NextRequest) {
  // managerId comes from the verified session, never from the request body —
  // same reasoning as /api/bets, /api/parlays, and /api/slots.
  const managerId = await getCurrentManagerId();
  if (managerId == null) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const { pickManagerId, amount } = body ?? {};
  if (typeof pickManagerId !== "number" || typeof amount !== "number") {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }

  const week = await getCurrentWeek(SEASON);
  if (!week) {
    return NextResponse.json({ ok: false, error: "No week open yet." }, { status: 400 });
  }

  const result = await placeFuturesBet(managerId, SEASON, week, pickManagerId, amount);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
