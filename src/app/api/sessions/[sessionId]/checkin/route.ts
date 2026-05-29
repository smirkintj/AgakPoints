import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ ok: true });
}
