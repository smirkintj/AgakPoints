import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const holidays = await prisma.sprintHoliday.findMany({
    where: { sessionId },
    select: { date: true, name: true },
  });
  return NextResponse.json({ holidays });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { holidays } = await req.json() as { holidays: { date: string; name: string }[] };

  // Delete all existing holidays for this session and replace
  await prisma.sprintHoliday.deleteMany({ where: { sessionId } });
  if (holidays.length > 0) {
    await prisma.sprintHoliday.createMany({
      data: holidays.map((h) => ({ sessionId, date: h.date, name: h.name })),
    });
  }

  return NextResponse.json({ ok: true });
}
