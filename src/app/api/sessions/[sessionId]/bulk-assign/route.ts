import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAssignee } from "@/lib/jira";
import { decryptProduct } from "@/lib/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { assignments } = await req.json() as { assignments: { ticketId: string; memberId: string }[] };

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return NextResponse.json({ error: "No assignments provided" }, { status: 400 });
  }

  // Update all tickets in parallel
  await Promise.all(
    assignments.map(({ ticketId, memberId }) =>
      prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId: memberId } })
    )
  );

  // Fire-and-forget JIRA writes
  const pokerSession = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: {
      product: true,
      tickets: { where: { id: { in: assignments.map((a) => a.ticketId) } } },
    },
  });

  const sessionProduct = pokerSession ? decryptProduct(pokerSession.product) : null;
  if (sessionProduct?.jiraBaseUrl && sessionProduct.jiraEmail && sessionProduct.jiraApiToken) {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = sessionProduct;
    const ticketMap = Object.fromEntries(pokerSession!.tickets.map((t) => [t.id, t.jiraKey]));
    void Promise.all(
      assignments.map(({ ticketId, memberId }) => {
        const jiraKey = ticketMap[ticketId];
        if (!jiraKey) return Promise.resolve();
        return updateAssignee(jiraBaseUrl, jiraEmail, jiraApiToken, jiraKey, memberId).catch((err) =>
          console.error(`[bulk-assign] JIRA updateAssignee failed for ${jiraKey}:`, err)
        );
      })
    );
  }

  return NextResponse.json({ updated: assignments.length });
}
