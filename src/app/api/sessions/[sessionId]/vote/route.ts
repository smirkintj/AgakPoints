import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/ably";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { memberId, ticketId, value } = await req.json();

  await prisma.vote.upsert({
    where: { ticketId_memberId: { ticketId, memberId } },
    update: { value },
    create: { ticketId, memberId, value },
  });

  // Fetch all current votes for progress update
  const votes = await prisma.vote.findMany({
    where: { ticketId },
    select: { memberId: true },
  });

  const participants = await prisma.sessionParticipant.findMany({
    where: { sessionId, checkedIn: true },
    select: { memberId: true },
  });

  await publish(sessionId, {
    type: "VOTE_PROGRESS",
    votedCount: votes.length,
    totalCount: participants.length,
    votedMemberIds: votes.map((v: { memberId: string }) => v.memberId),
  });

  return NextResponse.json({ ok: true });
}
