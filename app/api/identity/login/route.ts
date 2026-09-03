import { NextRequest, NextResponse } from "next/server";
import { loginOrClaimPin } from "@/lib/queries";
import { signManagerSession } from "@/lib/session";
import { IDENTITY_COOKIE } from "@/lib/identityCookie";

export async function POST(req: NextRequest) {
  const { managerId, pin, confirmPin } = await req.json();
  if (typeof managerId !== "number" || typeof pin !== "string") {
    return NextResponse.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }

  const result = await loginOrClaimPin(managerId, pin, typeof confirmPin === "string" ? confirmPin : undefined);
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(IDENTITY_COOKIE, signManagerSession(managerId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 days
  });
  return res;
}
