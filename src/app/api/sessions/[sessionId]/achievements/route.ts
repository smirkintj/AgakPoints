import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const memberId = req.nextUrl.searchParams.get("memberId");

  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const where = memberId ? { sessionId, memberId } : { sessionId };

  const achievements = await prisma.achievement.findMany({ where });
  return NextResponse.json({ achievements });
}
