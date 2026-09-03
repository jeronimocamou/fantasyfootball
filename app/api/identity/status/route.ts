import { NextRequest, NextResponse } from "next/server";
import { getManagerHasPin } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const managerId = Number(new URL(req.url).searchParams.get("managerId"));
  if (!Number.isFinite(managerId)) {
    return NextResponse.json({ error: "Invalid managerId" }, { status: 400 });
  }
  const hasPin = await getManagerHasPin(managerId);
  return NextResponse.json({ hasPin });
}
