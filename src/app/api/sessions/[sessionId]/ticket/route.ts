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

  await prisma.ticket.updateMany({
    where: { sessionId, status: "VOTING" },
    data: { status: "PENDING" },
  });
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "VOTING" },
  });

  await publish(sessionId, { type: "TICKET_OPENED", ticketId });
  return NextResponse.json({ ok: true });
}
