import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionForAdmin(sessionId: string, userId: string) {
  return prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: userId } },
    select: { id: true },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const holidays = await prisma.sprintHoliday.findMany({
    where: { sessionId },
  });
  return NextResponse.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  const pokerSession = await getSessionForAdmin(sessionId, session.user.id);
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    holidays,
    date,
    name,
    type,
    remove,
    country,
  } = body as {
    holidays?: { date: string; name: string; type?: string; country?: string | null }[];
    date?: string;
    name?: string;
    type?: string;
    remove?: boolean;
    country?: string | null;
  };

  if (holidays !== undefined) {
    if (!Array.isArray(holidays)) {
      return NextResponse.json({ error: "holidays must be an array" }, { status: 400 });
    }
    await prisma.sprintHoliday.deleteMany({ where: { sessionId } });
    if (holidays.length > 0) {
      await prisma.sprintHoliday.createMany({
        data: holidays.map((h) => ({
          sessionId,
          date: String(h.date),
          name: String(h.name).slice(0, 100),
          type: h.type ?? "PH",
          country: h.country ? String(h.country).slice(0, 10) : null,
        })),
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (date !== undefined) {
    const safeDate = String(date);
    if (remove === true) {
      await prisma.sprintHoliday.deleteMany({ where: { sessionId, date: safeDate } });
    } else {
      await prisma.sprintHoliday.deleteMany({ where: { sessionId, date: safeDate } });
      await prisma.sprintHoliday.create({
        data: {
          sessionId,
          date: safeDate,
          name: name ? String(name).slice(0, 100) : "Public Holiday",
          type: type ?? "PH",
          country: country ? String(country).slice(0, 10) : null,
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
