import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "cy_admin_session";

// The cookie is httpOnly (unlike the casual cy_manager_id picker cookie),
// so it can't be forged via document.cookie in devtools the way the
// regular identity cookie can be — this one genuinely requires knowing
// ADMIN_PIN, checked server-side in /api/admin/login.
export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === secret;
}
