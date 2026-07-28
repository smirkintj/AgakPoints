import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAdminToken } from "@/lib/partykit-token";

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

  // Tell the live room so connected members are moved off the session now
  // rather than on their next reload.
  try {
    const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const res = await fetch(`${protocol}://${host}/parties/main/${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": generateAdminToken(sessionId),
      },
      body: JSON.stringify({ type: "SESSION_ENDED" }),
    });
    if (!res.ok) {
      console.error(
        `[abandon] PartyKit broadcast failed for ${sessionId}: ${res.status} ${res.statusText}`
      );
    }
  } catch (err) {
    // Non-fatal — clients will see COMPLETED on next page load / poll.
    console.error(`[abandon] PartyKit broadcast threw for ${sessionId}:`, err);
  }

  return NextResponse.json({ success: true });
}
