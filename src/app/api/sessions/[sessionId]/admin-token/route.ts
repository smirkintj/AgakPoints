import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAdminToken } from "@/lib/partykit-token";

export async function GET(
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
  if (!pokerSession) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ token: generateAdminToken(sessionId) });
}
