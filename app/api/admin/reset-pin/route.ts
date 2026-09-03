import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resetManagerPin } from "@/lib/queries";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const { managerId } = await req.json();
  if (typeof managerId !== "number") {
    return NextResponse.json({ ok: false, error: "Missing managerId." }, { status: 400 });
  }
  const result = await resetManagerPin(managerId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
