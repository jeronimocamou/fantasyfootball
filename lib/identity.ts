import { cookies } from "next/headers";
import { IDENTITY_COOKIE } from "./identityCookie";
import { verifyManagerSession } from "./session";

export async function getCurrentManagerId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(IDENTITY_COOKIE)?.value;
  return verifyManagerSession(token);
}
