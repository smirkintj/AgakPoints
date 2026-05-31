import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { productId: true },
  });
  if (!session) return NextResponse.json({}, { status: 404 });

  // All sessions for product, desc order
  const allSessions = await prisma.pokerSession.findMany({
    where: { productId: session.productId },
    orderBy: { createdAt: "desc" },
    select: { id: true, participants: { select: { memberId: true, checkedIn: true } } },
  });

  // All members
  const members = await prisma.member.findMany({
    where: { productId: session.productId },
    select: { id: true },
  });

  const streaks: Record<string, number> = {};
  for (const m of members) {
    let streak = 0;
    for (const s of allSessions) {
      const p = s.participants.find(p => p.memberId === m.id);
      if (p?.checkedIn) streak++;
      else break;
    }
    streaks[m.id] = streak;
  }

  return NextResponse.json({ streaks });
}
