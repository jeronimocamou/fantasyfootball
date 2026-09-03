import { NextRequest, NextResponse } from "next/server";
import { placeParlay, type ParlayLegInput } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";

export async function POST(req: NextRequest) {
  // Same reasoning as /api/bets: managerId must come from the verified
  // session, not the request body, or the PIN system is bypassable.
  const managerId = await getCurrentManagerId();
  if (managerId == null) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const { legs, amount } = body ?? {};

  if (
    typeof amount !== "number" ||
    !Array.isArray(legs) ||
    legs.some(
      (l) => typeof l?.lineId !== "number" || typeof l?.sideManagerId !== "number"
    )
  ) {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }

  const result = await placeParlay(managerId, legs as ParlayLegInput[], amount);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
