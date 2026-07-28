import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MemberRole } from "@prisma/client";

export type MemberAuthResult =
  | { ok: true; via: "host" | "member" }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Authorize a mutation on a session that participants — who have no user
 * account — are allowed to make.
 *
 * Two ways through:
 *   - the signed-in host who owns the session's product, or
 *   - a member of that product, in one of `allowedRoles`, checked in to the
 *     session.
 *
 * The member path trusts a `memberId` supplied by the caller, which is the same
 * trust level as check-in and voting: anyone holding the session link can claim
 * to be any member of it. That is a known property of the link-based join flow,
 * not something this function fixes. What it does fix is the previous state,
 * where these routes had no authorization at all and any anonymous caller who
 * knew two IDs could write to a ticket.
 */
export async function authorizeSessionMutation(
  sessionId: string,
  memberId: string | undefined,
  allowedRoles: MemberRole[]
): Promise<MemberAuthResult> {
  const pokerSession = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, product: { select: { adminId: true } } },
  });
  if (!pokerSession) return { ok: false, status: 404, error: "Not found" };

  const userSession = await auth();
  if (userSession?.user?.id && userSession.user.id === pokerSession.product.adminId) {
    return { ok: true, via: "host" };
  }

  if (!memberId) {
    return { ok: false, status: 401, error: "memberId required" };
  }

  // Completed sessions are read-only; a stale tab shouldn't keep writing.
  if (pokerSession.status === "COMPLETED") {
    return { ok: false, status: 403, error: "Session has ended" };
  }

  const participant = await prisma.sessionParticipant.findUnique({
    where: { sessionId_memberId: { sessionId, memberId } },
    select: { checkedIn: true, member: { select: { role: true } } },
  });
  if (!participant?.checkedIn) {
    return { ok: false, status: 403, error: "Not a checked-in participant" };
  }
  if (!allowedRoles.includes(participant.member.role)) {
    return { ok: false, status: 403, error: "Role not permitted" };
  }

  return { ok: true, via: "member" };
}
