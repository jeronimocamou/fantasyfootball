import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/adminAuth";
import { resetManagerWeekBalance } from "@/lib/queries";

// Resetting a balance is more consequential than the other house
// actions here — it zeroes out someone's week — so on top of the usual
// admin session check, it re-verifies the admin PIN itself, same check
// /api/admin/login uses. Being logged in as admin isn't enough on its
// own for this one.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const { managerId, season, week, pin } = await req.json();
  const correctPin = process.env.ADMIN_PIN;
  if (!correctPin) {
    return NextResponse.json({ ok: false, error: "Admin login isn't configured." }, { status: 500 });
  }
  if (typeof pin !== "string" || pin !== correctPin) {
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }
  if (typeof managerId !== "number" || typeof season !== "number" || typeof week !== "number") {
    return NextResponse.json({ ok: false, error: "Missing or invalid fields." }, { status: 400 });
  }

  const result = await resetManagerWeekBalance(managerId, season, week);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
