import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { adjustBalance } from "@/lib/queries";

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  const { managerId, season, week, amount, note } = await req.json();
  if (
    typeof managerId !== "number" ||
    typeof season !== "number" ||
    typeof week !== "number" ||
    typeof amount !== "number"
  ) {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }
  const result = await adjustBalance(managerId, season, week, amount, typeof note === "string" ? note : "");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
