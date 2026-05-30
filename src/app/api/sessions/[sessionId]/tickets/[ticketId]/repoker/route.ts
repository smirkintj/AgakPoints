import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, ticketId } = await params;

  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
  });
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "PENDING", finalEstimate: null, assigneeId: null },
  });

  return NextResponse.json({ ok: true });
}
