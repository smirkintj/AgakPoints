import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
    select: { id: true },
  });
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.pokerSession.update({
    where: { id: sessionId },
    data: { status: "ACTIVE" },
  });

  return NextResponse.json({ ok: true });
}
