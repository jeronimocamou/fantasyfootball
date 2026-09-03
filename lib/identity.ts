import { cookies } from "next/headers";
import { IDENTITY_COOKIE } from "./identityCookie";

export async function getCurrentManagerId(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(IDENTITY_COOKIE)?.value;
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) ? id : null;
}
