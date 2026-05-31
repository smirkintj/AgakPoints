import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DesignReadiness, DesignComplexity } from "@prisma/client";

const VALID_READINESS = ["READY", "IN_PROGRESS", "NOT_STARTED", null];
const VALID_COMPLEXITY = ["LOW", "MEDIUM", "HIGH", null];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sessionId: string; ticketId: string }> }) {
  const { sessionId, ticketId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { designReadiness, designComplexity, designLink } = body as Record<string, unknown>;

  if (designReadiness !== undefined && !VALID_READINESS.includes(designReadiness as string | null)) {
    return NextResponse.json({ error: "Invalid designReadiness" }, { status: 400 });
  }
  if (designComplexity !== undefined && !VALID_COMPLEXITY.includes(designComplexity as string | null)) {
    return NextResponse.json({ error: "Invalid designComplexity" }, { status: 400 });
  }
  if (designLink !== undefined && designLink !== null) {
    if (typeof designLink !== "string" || designLink.length > 500) {
      return NextResponse.json({ error: "Invalid designLink" }, { status: 400 });
    }
    try {
      new URL(designLink);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  // Verify ticket belongs to sessionId (prevent IDOR)
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, sessionId }, select: { id: true } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(designReadiness !== undefined && { designReadiness: designReadiness as DesignReadiness | null }),
      ...(designComplexity !== undefined && { designComplexity: designComplexity as DesignComplexity | null }),
      ...(designLink !== undefined && { designLink: designLink as string | null }),
    },
  });
  return NextResponse.json({ success: true });
}
