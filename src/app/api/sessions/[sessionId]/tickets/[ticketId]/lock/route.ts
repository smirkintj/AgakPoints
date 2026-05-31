import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, ticketId } = await params;
  const { value, note, assigneeId } = await req.json();

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { finalEstimate: value, status: "ESTIMATED", adminNote: note ?? null, assigneeId: assigneeId ?? null },
  });

  void sessionId;
  return NextResponse.json({ success: true });
}
