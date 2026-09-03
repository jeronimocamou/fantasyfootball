import { NextRequest, NextResponse } from "next/server";
import { placeBet } from "@/lib/queries";
import { getCurrentManagerId } from "@/lib/identity";

export async function POST(req: NextRequest) {
  // managerId comes from the verified session, never from the request body —
  // trusting a client-supplied managerId here would let anyone bet as
  // anyone regardless of PIN, since the body is fully attacker-controlled.
  const managerId = await getCurrentManagerId();
  if (managerId == null) {
    return NextResponse.json({ ok: false, error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const { lineId, sideManagerId, amount } = body ?? {};

  if (
    typeof lineId !== "number" ||
    typeof sideManagerId !== "number" ||
    typeof amount !== "number"
  ) {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }

  const result = await placeBet(managerId, lineId, sideManagerId, amount);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
