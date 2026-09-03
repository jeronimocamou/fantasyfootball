import { NextRequest, NextResponse } from "next/server";
import { placeBet } from "@/lib/queries";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { managerId, lineId, sideManagerId, amount } = body ?? {};

  if (
    typeof managerId !== "number" ||
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
