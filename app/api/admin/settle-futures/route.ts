import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { settleFutures } from "@/lib/queries";

// Settling futures pays out (or wipes out) every pending season-long bet
// at once and can't be undone — same PIN re-verification as Reset
// Balance, on top of the usual admin session check.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const { season, championManagerId, week, pin } = await req.json();
  const correctPin = process.env.ADMIN_PIN;
  if (!correctPin) {
    return NextResponse.json({ ok: false, error: "Admin login isn't configured." }, { status: 500 });
  }
  if (typeof pin !== "string" || pin !== correctPin) {
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }
  if (typeof season !== "number" || typeof championManagerId !== "number" || typeof week !== "number") {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }

  const result = await settleFutures(season, championManagerId, week);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
