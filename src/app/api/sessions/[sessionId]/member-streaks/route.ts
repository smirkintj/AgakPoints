import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { productId: true },
  });
  if (!session) return NextResponse.json({}, { status: 404 });

  // Verify requester is a product member
  const memberId = req.nextUrl.searchParams.get("memberId");
  if (memberId) {
    const isMember = await prisma.member.findFirst({
      where: { id: memberId, productId: session.productId },
      select: { id: true },
    });
    if (!isMember) return NextResponse.json({}, { status: 403 });
  }

  // Single query: all sessions desc with only checkedIn participants
  // Using a flat participants query avoids the nested loop O(sessions × members)
  const [allSessions, members] = await Promise.all([
    prisma.pokerSession.findMany({
      where: { productId: session.productId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        participants: {
          where: { checkedIn: true },
          select: { memberId: true },
        },
      },
    }),
    prisma.member.findMany({
      where: { productId: session.productId },
      select: { id: true },
    }),
  ]);

  // Pre-build a Set<memberId> per session for O(1) lookup instead of O(n) find
  const attendedSets = allSessions.map(
    (s) => new Set(s.participants.map((p) => p.memberId))
  );

  const streaks: Record<string, number> = {};
  for (const m of members) {
    let streak = 0;
    for (const attended of attendedSets) {
      if (attended.has(m.id)) streak++;
      else break;
    }
    streaks[m.id] = streak;
  }

  // Find the most recently completed session before this one
  const prevSession = await prisma.pokerSession.findFirst({
    where: {
      productId: session.productId,
      status: "COMPLETED",
      id: { not: sessionId },
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  const memberIds = members.map((m) => m.id);
  const badges: Record<string, string[]> = {};
  if (prevSession) {
    const prevBadges = await prisma.achievement.findMany({
      where: { memberId: { in: memberIds }, sessionId: prevSession.id },
      select: { memberId: true, type: true },
    });
    for (const b of prevBadges) {
      badges[b.memberId] = [...(badges[b.memberId] ?? []), b.type];
    }
  }

  return NextResponse.json({ streaks, badges });
}
