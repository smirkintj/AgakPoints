import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { clientIp, consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

const WINDOW_MS = 15 * 60 * 1000;

// Throttle where the attempts come from rather than the account being targeted.
// Keying the tight limit on the account would let anyone lock a colleague out by
// burning failures against their email, so the per-account budget is deliberately
// looser and exists only to slow credential stuffing spread across many IPs.
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_ACCOUNT = 20;

class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        // Registration stores emails lowercased; match that here or anyone who
        // signs up with capitals can never sign in.
        const email = (credentials.email as string).trim().toLowerCase();
        const ip = request instanceof Request ? clientIp(request) : "unknown";
        const accountKey = `login:acct:${email}`;

        // Spend the budget before any bcrypt work, so a throttled caller can't
        // use password comparisons as a CPU amplification lever.
        const [ipCheck, accountCheck] = await Promise.all([
          consumeRateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS),
          consumeRateLimit(accountKey, MAX_ATTEMPTS_PER_ACCOUNT, WINDOW_MS),
        ]);
        if (ipCheck.limited || accountCheck.limited) throw new RateLimitedSignin();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        // Clear the account counter on success so someone who fat-fingered their
        // password a few times isn't left sitting near the limit.
        await resetRateLimit(accountKey);

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
