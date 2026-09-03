import { NextResponse } from "next/server";
import { IDENTITY_COOKIE } from "@/lib/identityCookie";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(IDENTITY_COOKIE);
  return res;
}
