import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAll } from "@/lib/achievements";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  const pokerSession = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: { product: { select: { adminId: true } } },
  });

  if (!pokerSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || pokerSession.product.adminId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pokerSession.status === "COMPLETED") {
    return NextResponse.json({ success: true });
  }

  // Gather data for achievement evaluation
  const [sessionTickets, sessionVotes, sessionParticipants] = await Promise.all([
    prisma.ticket.findMany({
      where: { sessionId, finalEstimate: { not: null } },
      select: { id: true, finalEstimate: true, assigneeId: true },
    }),
    prisma.vote.findMany({
      where: { ticket: { sessionId } },
      select: { ticketId: true, memberId: true, value: true, createdAt: true },
    }),
    prisma.sessionParticipant.findMany({
      where: { sessionId, checkedIn: true },
      select: { memberId: true, joinedAt: true },
    }),
  ]);

  const assignments = sessionTickets
    .filter(t => t.assigneeId && t.finalEstimate)
    .map(t => ({ memberId: t.assigneeId!, storyPoints: t.finalEstimate! }));

  const achievementResults = evaluateAll({
    tickets: sessionTickets,
    votes: sessionVotes,
    participants: sessionParticipants,
    assignments,
  });

  if (achievementResults.length > 0) {
    try {
      await prisma.achievement.createMany({
        data: achievementResults.map(r => ({ ...r, sessionId })),
        skipDuplicates: true,
      });
    } catch (err) {
      console.error("[end] achievement createMany failed:", err);
    }
  }

  await prisma.pokerSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return NextResponse.json({ success: true, achievements: achievementResults });
}
