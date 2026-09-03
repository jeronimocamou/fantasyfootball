import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET — set it in .env.local");
  return secret;
}

// Signs a manager id into a cookie value the server can trust — unlike the
// old plain `cy_manager_id=5` cookie, this can't be forged by setting
// document.cookie in devtools, since producing a valid signature requires
// SESSION_SECRET, which never reaches the client.
export function signManagerSession(managerId: number): string {
  const hmac = createHmac("sha256", getSecret()).update(String(managerId)).digest("hex");
  return `${managerId}.${hmac}`;
}

export function verifyManagerSession(token: string | undefined): number | null {
  if (!token) return null;
  const [idPart, hmacPart] = token.split(".");
  if (!idPart || !hmacPart) return null;
  const managerId = Number(idPart);
  if (!Number.isFinite(managerId)) return null;

  const expected = createHmac("sha256", getSecret()).update(idPart).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(hmacPart, "hex");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  return managerId;
}
