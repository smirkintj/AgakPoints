import { createHmac } from "crypto";

export function generateAdminToken(sessionId: string): string {
  const secret = process.env.PARTYKIT_SECRET ?? "dev-secret";
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}
