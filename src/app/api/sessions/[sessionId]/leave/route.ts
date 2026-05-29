import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const leaves = await prisma.sprintLeave.findMany({
    where: { sessionId },
    select: { memberId: true, date: true },
  });
  return NextResponse.json({ leaves });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { memberId, date, active } = await req.json();

  if (active) {
    await prisma.sprintLeave.upsert({
      where: { sessionId_memberId_date: { sessionId, memberId, date } },
      update: {},
      create: { sessionId, memberId, date },
    });
  } else {
    await prisma.sprintLeave.deleteMany({
      where: { sessionId, memberId, date },
    });
  }

  return NextResponse.json({ ok: true });
}
