import { NextRequest, NextResponse } from "next/server";
import { publish } from "@/lib/ably";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { memberId, memberName, emoji } = await req.json();

  await publish(sessionId, { type: "REACTION_RECEIVED", memberId, memberName, emoji });
  return NextResponse.json({ ok: true });
}
