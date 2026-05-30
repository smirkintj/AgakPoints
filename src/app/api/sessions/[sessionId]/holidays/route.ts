import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const holidays = await prisma.sprintHoliday.findMany({
    where: { sessionId },
    select: { date: true, name: true, type: true },
  });
  return NextResponse.json({ holidays });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json() as {
    holidays?: { date: string; name: string; type?: string }[];
    date?: string;
    name?: string;
    type?: string;
    remove?: boolean;
  };

  // Legacy bulk replace
  if (body.holidays !== undefined) {
    await prisma.sprintHoliday.deleteMany({ where: { sessionId } });
    if (body.holidays.length > 0) {
      await prisma.sprintHoliday.createMany({
        data: body.holidays.map((h) => ({
          sessionId,
          date: h.date,
          name: h.name,
          type: h.type ?? "PH",
        })),
      });
    }
    return NextResponse.json({ ok: true });
  }

  // Per-entry upsert / delete
  if (body.date !== undefined) {
    if (body.remove === true) {
      await prisma.sprintHoliday.deleteMany({ where: { sessionId, date: body.date } });
    } else {
      await prisma.sprintHoliday.deleteMany({ where: { sessionId, date: body.date } });
      await prisma.sprintHoliday.create({
        data: {
          sessionId,
          date: body.date,
          name: body.name ?? "Public Holiday",
          type: body.type ?? "PH",
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
