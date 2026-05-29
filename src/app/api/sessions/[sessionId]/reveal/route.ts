import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/ably";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { ticketId } = await req.json();

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "REVEALED" },
  });

  const votes = await prisma.vote.findMany({
    where: { ticketId },
    include: { member: { select: { id: true, name: true } } },
  });

  await publish(sessionId, {
    type: "VOTES_REVEALED",
    votes: votes.map((v: { memberId: string; member: { name: string }; value: number }) => ({
      memberId: v.memberId,
      memberName: v.member.name,
      value: v.value,
    })),
  });

  return NextResponse.json({ ok: true });
}
