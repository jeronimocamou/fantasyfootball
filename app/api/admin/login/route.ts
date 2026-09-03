import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const correctPin = process.env.ADMIN_PIN;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!correctPin || !secret) {
    return NextResponse.json({ ok: false, error: "Admin login isn't configured." }, { status: 500 });
  }
  if (typeof pin !== "string" || pin !== correctPin) {
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
