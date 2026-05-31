import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSessionForAdmin(sessionId: string, userId: string) {
  return prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: userId } },
    select: { id: true, product: { select: { members: { select: { id: true } } } } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  const where: Record<string, unknown> = { sessionId };
  if (memberId) where.memberId = memberId;
  const leaves = await prisma.sprintLeave.findMany({ where, select: { memberId: true, date: true } });
  return NextResponse.json({ leaves });
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

  const { memberId, date, active } = body as {
    memberId?: string;
    date?: string;
    active?: boolean;
  };

  if (!memberId || typeof memberId !== "string" || !date || typeof date !== "string") {
    return NextResponse.json({ error: "memberId and date required" }, { status: 400 });
  }

  const memberIds = pokerSession.product.members.map((m) => m.id);
  if (!memberIds.includes(memberId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
