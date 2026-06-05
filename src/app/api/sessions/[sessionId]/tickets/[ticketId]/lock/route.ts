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
  const body = await req.json();
  const { value, note, assigneeId } = body;
  const noteForDev: string | undefined = typeof body.noteForDev === "string" ? body.noteForDev.slice(0, 2000) : undefined;
  const noteForQA: string | undefined = typeof body.noteForQA === "string" ? body.noteForQA.slice(0, 2000) : undefined;
  const noteForUIUX: string | undefined = typeof body.noteForUIUX === "string" ? body.noteForUIUX.slice(0, 2000) : undefined;

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, sessionId }, select: { id: true, status: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status === "ESTIMATED") return NextResponse.json({ success: true });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      finalEstimate: value,
      status: "ESTIMATED",
      adminNote: note ?? null,
      assigneeId: assigneeId ?? null,
      ...(noteForDev !== undefined && { noteForDev: noteForDev || null }),
      ...(noteForQA !== undefined && { noteForQA: noteForQA || null }),
      ...(noteForUIUX !== undefined && { noteForUIUX: noteForUIUX || null }),
    },
  });

  return NextResponse.json({ success: true });
}
