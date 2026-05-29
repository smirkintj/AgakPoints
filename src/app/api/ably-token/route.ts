import { NextResponse } from "next/server";
import { getAblyRest } from "@/lib/ably";

export async function GET() {
  const ably = getAblyRest();
  const tokenRequest = await ably.auth.createTokenRequest({
    capability: { "session:*": ["subscribe"] },
  });
  return NextResponse.json(tokenRequest);
}
