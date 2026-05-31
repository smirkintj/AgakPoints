import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchSprintIssues } from "@/lib/jira";
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
    include: {
      tickets: true,
      product: true,
    },
  });
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = decryptProduct(pokerSession.product);

  if (!product.jiraBaseUrl || !product.jiraEmail || !product.jiraApiToken) {
    return NextResponse.json({ error: "No JIRA configured" }, { status: 400 });
  }

  const issues = await fetchSprintIssues(
    product.jiraBaseUrl,
    product.jiraEmail,
    product.jiraApiToken,
    pokerSession.sprintId
  );

  const freshTickets = issues
    .filter((issue) => {
      const t = issue.fields.issuetype?.name;
      return t !== "Subtask" && t !== "Sub-task";
    })
    .map((issue, i) => ({
      jiraKey: issue.key,
      title: issue.fields.summary,
      order: i,
      issueType: issue.fields.issuetype?.name ?? "Story",
      jiraAssigneeName: issue.fields.assignee?.displayName ?? null,
      jiraAssigneeAccountId: issue.fields.assignee?.accountId ?? null,
      priority: issue.fields.priority?.name ?? null,
    }));

  // Delete all non-estimated tickets, then upsert fresh ones
  await prisma.ticket.deleteMany({
    where: { sessionId, status: { not: "ESTIMATED" } },
  });

  const existingKeys = new Set(
    pokerSession.tickets
      .filter((t) => t.status === "ESTIMATED")
      .map((t) => t.jiraKey)
  );

  const toCreate = freshTickets.filter((t) => !existingKeys.has(t.jiraKey));

  if (toCreate.length > 0) {
    await prisma.ticket.createMany({
      data: toCreate.map((t) => ({ ...t, sessionId })),
    });
  }

  const updated = await prisma.ticket.findMany({
    where: { sessionId },
    orderBy: { order: "asc" },
    include: { votes: { include: { member: true } } },
  });

  return NextResponse.json({ tickets: updated });
}
