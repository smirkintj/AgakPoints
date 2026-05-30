import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchSprintIssues } from "@/lib/jira";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productId, sprintId, sprintName, sprintStartDate, sprintEndDate, name } = await req.json();

  const product = await prisma.product.findFirst({
    where: { id: productId, adminId: session.user.id },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let tickets: {
    jiraKey: string;
    title: string;
    description?: string;
    order: number;
    issueType?: string;
    jiraAssigneeName?: string | null;
    jiraAssigneeAccountId?: string | null;
    priority?: string | null;
  }[] = [];

  if (product.jiraBaseUrl && product.jiraEmail && product.jiraApiToken) {
    const issues = await fetchSprintIssues(
      product.jiraBaseUrl,
      product.jiraEmail,
      product.jiraApiToken,
      sprintId
    );
    tickets = issues
      .filter((issue) => {
        const t = issue.fields.issuetype?.name;
        return t !== "Subtask" && t !== "Sub-task";
      })
      .map((issue, i) => ({
        jiraKey: issue.key,
        title: issue.fields.summary,
        description: undefined,
        order: i,
        issueType: issue.fields.issuetype?.name ?? "Story",
        jiraAssigneeName: issue.fields.assignee?.displayName ?? null,
        jiraAssigneeAccountId: issue.fields.assignee?.accountId ?? null,
        priority: issue.fields.priority?.name ?? null,
      }));
  }

  const pokerSession = await prisma.pokerSession.create({
    data: {
      productId,
      sprintId: String(sprintId),
      sprintName,
      name: name || undefined,
      sprintStartDate: sprintStartDate ? new Date(sprintStartDate) : null,
      sprintEndDate: sprintEndDate ? new Date(sprintEndDate) : null,
      tickets: { create: tickets },
    },
    include: { tickets: true },
  });

  return NextResponse.json(pokerSession);
}
