import { NextRequest, NextResponse } from "next/server";
import { placeParlay, type ParlayLegInput } from "@/lib/queries";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { managerId, legs, amount } = body ?? {};

  if (
    typeof managerId !== "number" ||
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
