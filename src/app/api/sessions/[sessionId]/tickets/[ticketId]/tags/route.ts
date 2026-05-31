import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string; ticketId: string }> }) {
  const { ticketId } = await params;
  const { tags } = await req.json();
  await prisma.ticket.update({ where: { id: ticketId }, data: { tags } });
  return NextResponse.json({ success: true });
}
