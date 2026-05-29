import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/ably";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { memberId } = await req.json();

  await prisma.sessionParticipant.upsert({
    where: { sessionId_memberId: { sessionId, memberId } },
    update: { checkedIn: true },
    create: { sessionId, memberId, checkedIn: true },
  });

  // Broadcast updated presence list
  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId, checkedIn: true },
    include: { member: { select: { id: true, name: true } } },
  });

  await publish(sessionId, {
    type: "PRESENCE_UPDATE",
    checkedIn: participants.map((p: { member: { id: string; name: string } }) => ({
      memberId: p.member.id,
      memberName: p.member.name,
    })),
  });

  return NextResponse.json({ ok: true });
}
