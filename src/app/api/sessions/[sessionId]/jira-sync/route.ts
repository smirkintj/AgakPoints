import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptProduct } from "@/lib/crypto";
const syncAttempts = new Map<string, { count: number; resetAt: number }>();
function isSyncRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = syncAttempts.get(sessionId);
  if (!entry || now > entry.resetAt) {
    syncAttempts.set(sessionId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 3;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  if (isSyncRateLimited(sessionId)) return NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
    include: {
      tickets: {
        where: { status: "ESTIMATED" },
        include: { votes: { include: { member: true } } },
      },
      participants: { include: { member: true } },
      product: true,
    },
  });
  if (!pokerSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = decryptProduct(pokerSession.product);
  if (!product.jiraBaseUrl || !product.jiraEmail || !product.jiraApiToken) {
    return NextResponse.json({
      results: pokerSession.tickets.map((t) => ({
        ticketId: t.id,
        jiraKey: t.jiraKey,
        title: t.title,
        sp: { ok: false, error: "No JIRA credentials" },
        assignee: { ok: false, skipped: true },
        comment: { ok: false, error: "No JIRA credentials" },
      })),
    });
  }

  const authHeader = "Basic " + Buffer.from(`${product.jiraEmail}:${product.jiraApiToken}`).toString("base64");
  const attendees = pokerSession.participants
    .filter((p) => p.checkedIn)
    .map((p) => p.member.name);

  const results = await Promise.all(
    pokerSession.tickets.map(async (t) => {
      const votes = t.votes.map((v) => ({ name: v.member.name, value: v.value }));

      const adfBody = {
        version: 1,
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: `Sprint: ${pokerSession.sprintName}` }] },
          { type: "paragraph", content: [{ type: "text", text: `Estimate: ${t.finalEstimate} pts` }] },
          { type: "paragraph", content: [{ type: "text", text: `Attendees: ${attendees.join(", ")}` }] },
          { type: "paragraph", content: [{ type: "text", text: `Votes: ${votes.map((v) => `${v.name}: ${v.value}`).join(", ")}` }] },
          ...(t.adminNote ? [{ type: "paragraph", content: [{ type: "text", text: `Note: ${t.adminNote}` }] }] : []),
        ],
      };

      const [spResult, commentResult, assigneeResult] = await Promise.allSettled([
        fetch(`${product.jiraBaseUrl}/rest/api/3/issue/${t.jiraKey}`, {
          method: "PUT",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ fields: { story_points: t.finalEstimate } }),
        }),
        fetch(`${product.jiraBaseUrl}/rest/api/3/issue/${t.jiraKey}/comment`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ body: adfBody }),
        }),
        t.jiraAssigneeAccountId
          ? fetch(`${product.jiraBaseUrl}/rest/api/3/issue/${t.jiraKey}`, {
              method: "PUT",
              headers: { Authorization: authHeader, "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ fields: { assignee: { accountId: t.jiraAssigneeAccountId } } }),
            })
          : Promise.resolve(null),
      ]);

      const spOk = spResult.status === "fulfilled" && (spResult.value as Response).ok;
      const spError = spResult.status === "rejected"
        ? String(spResult.reason)
        : !spOk ? `HTTP ${(spResult.value as Response).status}` : undefined;

      const commentOk = commentResult.status === "fulfilled" && (commentResult.value as Response).ok;
      const commentError = commentResult.status === "rejected"
        ? String(commentResult.reason)
        : !commentOk ? `HTTP ${(commentResult.value as Response).status}` : undefined;

      let assignee: { ok: boolean; error?: string; skipped?: boolean };
      if (!t.jiraAssigneeAccountId) {
        assignee = { ok: false, skipped: true };
      } else if (assigneeResult.status === "rejected") {
        assignee = { ok: false, error: String(assigneeResult.reason) };
      } else {
        const res = assigneeResult.value as Response;
        assignee = res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
      }

      return {
        ticketId: t.id,
        jiraKey: t.jiraKey,
        title: t.title,
        sp: { ok: spOk, ...(spError ? { error: spError } : {}) },
        assignee,
        comment: { ok: commentOk, ...(commentError ? { error: commentError } : {}) },
      };
    })
  );

  return NextResponse.json({ results });
}
