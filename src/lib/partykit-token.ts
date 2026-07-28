import { createHmac } from "crypto";

/**
 * Shared secret proving to the PartyKit room that a connection really is the
 * session host. This app and the PartyKit worker must carry the same value
 * (see README — "Real-time sync (PartyKit)").
 *
 * There is deliberately no fallback. An admin token is just
 * HMAC-SHA256(sessionId), and session IDs travel in URLs, so a guessable secret
 * would let anyone forge host credentials for any session — reveal votes, lock
 * estimates, kick members. Failing loudly is the safer outcome.
 */
function getSecret(): string {
  const secret = process.env.PARTYKIT_SECRET;
  if (!secret) {
    throw new Error(
      "PARTYKIT_SECRET is not set. Generate one with `openssl rand -hex 32`, add it " +
        "to this app's environment, and register the same value with PartyKit via " +
        "`npx partykit env add PARTYKIT_SECRET`."
    );
  }
  return secret;
}

export function generateAdminToken(sessionId: string): string {
  return createHmac("sha256", getSecret()).update(sessionId).digest("hex");
}
