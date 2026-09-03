import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { cancelBet } from "@/lib/queries";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const { betId } = await req.json();
  if (typeof betId !== "number") {
    return NextResponse.json({ ok: false, error: "Missing betId." }, { status: 400 });
  }
  const result = await cancelBet(betId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
