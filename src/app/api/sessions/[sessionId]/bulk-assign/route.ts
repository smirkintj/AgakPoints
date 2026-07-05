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

  // Verify ownership and fetch tickets in one query
  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
    include: {
      product: true,
      tickets: { where: { id: { in: assignments.map((a) => a.ticketId) } } },
    },
  });
  if (!pokerSession) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ensure every ticketId belongs to this session
  const validIds = new Set(pokerSession.tickets.map((t) => t.id));
  if (assignments.some((a) => !validIds.has(a.ticketId))) {
    return NextResponse.json({ error: "Invalid ticket IDs" }, { status: 400 });
  }

  // Apply assignments
  await Promise.all(
    assignments.map(({ ticketId, memberId }) =>
      prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId: memberId } })
    )
  );

  // Fire-and-forget Jira writes
  const sessionProduct = decryptProduct(pokerSession.product);
  if (sessionProduct?.jiraBaseUrl && sessionProduct.jiraEmail && sessionProduct.jiraApiToken) {
    const { jiraBaseUrl, jiraEmail, jiraApiToken } = sessionProduct;
    const ticketMap = Object.fromEntries(pokerSession.tickets.map((t) => [t.id, t.jiraKey]));
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
