import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/ably";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  await prisma.pokerSession.update({
    where: { id: sessionId },
    data: { status: "ACTIVE" },
  });

  await publish(sessionId, { type: "SESSION_STARTED" });
  return NextResponse.json({ ok: true });
}
