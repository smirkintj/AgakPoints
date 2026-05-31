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

  // Fetch all sessions for product ordered desc, with participant checkedIn status
  const allSessions = await prisma.pokerSession.findMany({
    where: { productId: session.productId },
    orderBy: { createdAt: "desc" },
    select: { id: true, participants: { select: { memberId: true, checkedIn: true } } },
  });

  const members = await prisma.member.findMany({
    where: { productId: session.productId },
    select: { id: true },
  });

  // Build attendance map: memberId → boolean[] ordered desc (true = attended)
  const streaks: Record<string, number> = {};
  for (const m of members) {
    let streak = 0;
    for (const s of allSessions) {
      const p = s.participants.find((p) => p.memberId === m.id);
      if (p?.checkedIn) streak++;
      else break;
    }
    streaks[m.id] = streak;
  }

  return NextResponse.json({ streaks });
}
