import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { cancelParlay } from "@/lib/queries";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const { parlayId } = await req.json();
  if (typeof parlayId !== "number") {
    return NextResponse.json({ ok: false, error: "Missing parlayId." }, { status: 400 });
  }
  const result = await cancelParlay(parlayId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
