import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { cancelFuturesBet } from "@/lib/queries";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const { futuresBetId } = await req.json();
  if (typeof futuresBetId !== "number") {
    return NextResponse.json({ ok: false, error: "Missing futuresBetId." }, { status: 400 });
  }
  const result = await cancelFuturesBet(futuresBetId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
