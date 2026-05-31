import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptProduct } from "@/lib/crypto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
    include: { tickets: { where: { status: "ESTIMATED" } }, product: true },
  });
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = decryptProduct(pokerSession.product);
  if (!product.jiraBaseUrl || !product.jiraEmail || !product.jiraApiToken) {
    return NextResponse.json({ results: pokerSession.tickets.map((t) => ({ ticketId: t.id, jiraKey: t.jiraKey, ok: false, reason: "No JIRA credentials" })) });
  }

  const authHeader = "Basic " + Buffer.from(`${product.jiraEmail}:${product.jiraApiToken}`).toString("base64");
  const storyPointsField = "story_points";

  const results = await Promise.all(pokerSession.tickets.map(async (t) => {
    try {
      const fields: Record<string, unknown> = { [storyPointsField]: t.finalEstimate };
      const accountId = t.jiraAssigneeAccountId;
      if (accountId) {
        fields.assignee = { accountId };
      }
      const res = await fetch(`${product.jiraBaseUrl}/rest/api/3/issue/${t.jiraKey}`, {
        method: "PUT",
        headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fields }),
      });
      return { ticketId: t.id, jiraKey: t.jiraKey, ok: res.ok, reason: res.ok ? null : `HTTP ${res.status}` };
    } catch (e) {
      return { ticketId: t.id, jiraKey: t.jiraKey, ok: false, reason: String(e) };
    }
  }));

  return NextResponse.json({ results });
}
