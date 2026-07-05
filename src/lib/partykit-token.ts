import { createHmac } from "crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string | null {
  const secret = process.env.PARTYKIT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-secret";
  return null;
}

export function generateAdminToken(sessionId: string): string {
  const secret = getSecret();
  if (!secret) throw new Error("PARTYKIT_SECRET is not set in production");
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const hmac = createHmac("sha256", secret)
    .update(`${sessionId}:${expiresAt}`)
    .digest("hex");
  return `${hmac}.${expiresAt}`;
}
