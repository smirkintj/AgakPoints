import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStoryPoints, postSessionComment, buildSessionComment, updateAssignee } from "@/lib/jira";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, ticketId } = await params;
  const { value, note, votes, assigneeId } = await req.json();

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { finalEstimate: value, status: "ESTIMATED", adminNote: note ?? null, assigneeId: assigneeId ?? null },
    include: { session: { include: { product: true, participants: { include: { member: true } } } } },
  });

  const product = ticket.session.product;

  const jiraSync = { points: false, comment: false, assignee: false };

  if (product.jiraBaseUrl && product.jiraEmail && product.jiraApiToken) {
    const participants = ticket.session.participants
      .filter((p: { checkedIn: boolean }) => p.checkedIn)
      .map((p: { member: { name: string } }) => p.member.name);

    const commentText = buildSessionComment({
      sessionName: ticket.session.sprintName,
      participants,
      votes: (votes ?? []).map((v: { memberName: string; value: number }) => v),
      finalEstimate: value,
      note,
    });

    const [pointsResult, commentResult] = await Promise.allSettled([
      updateStoryPoints(product.jiraBaseUrl, product.jiraEmail, product.jiraApiToken, ticket.jiraKey, value),
      postSessionComment(product.jiraBaseUrl, product.jiraEmail, product.jiraApiToken, ticket.jiraKey, commentText),
    ]);
    jiraSync.points = pointsResult.status === "fulfilled";
    jiraSync.comment = commentResult.status === "fulfilled";

    // Write back assignee using jiraAssigneeAccountId from ticket (not internal memberId)
    if (ticket.jiraAssigneeAccountId) {
      try {
        await updateAssignee(product.jiraBaseUrl, product.jiraEmail, product.jiraApiToken, ticket.jiraKey, ticket.jiraAssigneeAccountId);
        jiraSync.assignee = true;
      } catch {
        jiraSync.assignee = false;
      }
    }
  }

  void sessionId; // used implicitly via ticket relation
  return NextResponse.json({ success: true, jiraSync });
}
