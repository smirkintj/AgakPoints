import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postSessionComment } from "@/lib/jira";
import { decryptProduct } from "@/lib/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { jiraIssueKey } = await req.json();

  if (!jiraIssueKey || !/^[A-Z]+-\d+$/.test(jiraIssueKey)) return NextResponse.json({ error: "Invalid jiraIssueKey" }, { status: 400 });

  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId },
    include: {
      tickets: { include: { assignee: true } },
      product: true,
    },
  });

  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Auth check: session's product must belong to the current admin
  if (pokerSession.product.adminId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const estimatedTickets = pokerSession.tickets.filter((t) => t.finalEstimate != null);
  const totalPoints = estimatedTickets.reduce((sum, t) => sum + (t.finalEstimate ?? 0), 0);

  // Build Atlassian Document Format comment
  const tableRows = estimatedTickets.map((t) => ({
    type: "tableRow",
    content: [
      {
        type: "tableCell",
        content: [{ type: "paragraph", content: [{ type: "text", text: t.jiraKey }] }],
      },
      {
        type: "tableCell",
        content: [{ type: "paragraph", content: [{ type: "text", text: t.title }] }],
      },
      {
        type: "tableCell",
        content: [{ type: "paragraph", content: [{ type: "text", text: String(t.finalEstimate ?? "") }] }],
      },
      {
        type: "tableCell",
        content: [{ type: "paragraph", content: [{ type: "text", text: t.assignee?.name ?? t.jiraAssigneeName ?? "—" }] }],
      },
    ],
  }));

  const adfBody = {
    type: "doc",
    version: 1,
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: `AgakPoints Sprint Summary — ${pokerSession.sprintName}` }],
      },
      {
        type: "table",
        attrs: { isNumberColumnEnabled: false, layout: "default" },
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Key" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Title" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Estimate" }] }] },
              { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Assignee" }] }] },
            ],
          },
          ...tableRows,
        ],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Total: ${totalPoints} points across ${estimatedTickets.length} tickets — ${new Date().toLocaleDateString()}`,
          },
        ],
      },
    ],
  };

  let jiraSync = false;

  const product = decryptProduct(pokerSession.product);
  if (product.jiraBaseUrl && product.jiraEmail && product.jiraApiToken) {
    try {
      // We post raw ADF body directly using a custom fetch since postSessionComment takes plain text
      const authHeader =
        "Basic " + Buffer.from(`${product.jiraEmail}:${product.jiraApiToken}`).toString("base64");
      const res = await fetch(`${product.jiraBaseUrl}/rest/api/3/issue/${jiraIssueKey}/comment`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ body: adfBody }),
      });
      jiraSync = res.ok;
    } catch {
      jiraSync = false;
    }
  }

  return NextResponse.json({ success: true, jiraSync });
}
