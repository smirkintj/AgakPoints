import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string; ticketId: string }> }) {
  const { sessionId, ticketId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tags } = body as Record<string, unknown>;

  if (!Array.isArray(tags)) return NextResponse.json({ error: "tags must be array" }, { status: 400 });
  if (tags.length > 20) return NextResponse.json({ error: "Too many tags" }, { status: 400 });
  if (tags.some((t: unknown) => typeof t !== "string" || t.length > 50)) {
    return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
  }

  // Verify ticket belongs to sessionId (prevent IDOR)
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, sessionId }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ticket.update({ where: { id: ticketId }, data: { tags } });
  return NextResponse.json({ success: true });
}
