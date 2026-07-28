import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Consume one unit against `key`, returning whether the caller is over budget.
 *
 * The counter lives in Postgres rather than process memory because serverless
 * instances don't share memory — an in-process Map resets on every cold start
 * and is per-instance, which makes it useless as a real limit.
 *
 * The whole check-and-increment is a single statement so concurrent requests
 * can't race past the limit. The window is fixed: the first request in a window
 * sets the expiry, and later requests in that window inherit it.
 *
 * Fails open. If the database is unreachable the app is already broken, and
 * locking everyone out of login on a transient blip is the worse failure.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const expiresAt = new Date(Date.now() + windowMs);

  try {
    const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."expiresAt" < NOW() THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" < NOW() THEN EXCLUDED."expiresAt"
          ELSE "RateLimit"."expiresAt"
        END
      RETURNING "count", "expiresAt"
    `;

    const row = rows[0];
    if (!row) return { limited: false, remaining: limit, retryAfterSeconds: 0 };

    const count = Number(row.count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / 1000)
    );

    return {
      limited: count > limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return { limited: false, remaining: limit, retryAfterSeconds: 0 };
  }
}

/**
 * Drop a counter — used after a successful login so a legitimate user isn't
 * punished for the failed attempts that preceded it.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch (err) {
    console.error("[rate-limit] reset failed:", err);
  }
}

/** Remove expired counters. Safe to call opportunistically. */
export async function pruneRateLimits(): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch (err) {
    console.error("[rate-limit] prune failed:", err);
  }
}

/**
 * Best-effort client IP. `x-forwarded-for` is set by the platform proxy; the
 * left-most entry is the original client. Returns "unknown" when absent, which
 * buckets all such callers together — deliberately conservative.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
