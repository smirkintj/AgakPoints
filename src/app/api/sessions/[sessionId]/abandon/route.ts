import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const pokerSession = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, createdAt: true },
  });

  if (!pokerSession) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (pokerSession.status === "COMPLETED") {
    return NextResponse.json({ success: true });
  }
  if (pokerSession.status !== "ACTIVE") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  const ageMs = Date.now() - new Date(pokerSession.createdAt).getTime();
  if (ageMs < MIN_AGE_MS) {
    return NextResponse.json({ error: "Session is less than 24h old" }, { status: 403 });
  }

  await prisma.pokerSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  // Broadcast SESSION_ENDED to all connected clients via PartyKit REST API
  try {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    await fetch(`${protocol}://${host}/parties/main/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SESSION_ENDED" }),
    });
  } catch {
    // Non-fatal — clients will see COMPLETED on next page load / poll
  }

  return NextResponse.json({ success: true });
}
