import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: {
      tickets: { orderBy: { order: "asc" }, include: { votes: { include: { member: true } } } },
      participants: { include: { member: true } },
      product: { include: { members: true } },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}
