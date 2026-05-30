import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { memberId } = body as { memberId?: string };
  if (!memberId || typeof memberId !== "string") {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }

  // Verify the session exists and the member belongs to its product
  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { id: true, product: { select: { members: { select: { id: true } } } } },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberIds = session.product.members.map((m) => m.id);
  if (!memberIds.includes(memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.sessionParticipant.upsert({
    where: { sessionId_memberId: { sessionId, memberId } },
    update: { checkedIn: true },
    create: { sessionId, memberId, checkedIn: true },
  });

  return NextResponse.json({ ok: true });
}
