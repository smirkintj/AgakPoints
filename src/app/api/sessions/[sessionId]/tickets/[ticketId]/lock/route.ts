import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateStoryPoints, postSessionComment, buildSessionComment } from "@/lib/jira";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; ticketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, ticketId } = await params;
  const { value, note, votes } = await req.json();

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { finalEstimate: value, status: "ESTIMATED", adminNote: note ?? null },
    include: { session: { include: { product: true, participants: { include: { member: true } } } } },
  });

  const product = ticket.session.product;

  // Write back to JIRA asynchronously (don't block the response)
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

    // Fire and forget — JIRA writes can be slow
    Promise.all([
      updateStoryPoints(product.jiraBaseUrl, product.jiraEmail, product.jiraApiToken, ticket.jiraKey, value).catch(console.error),
      postSessionComment(product.jiraBaseUrl, product.jiraEmail, product.jiraApiToken, ticket.jiraKey, commentText).catch(console.error),
    ]);
  }

  return NextResponse.json({ success: true });
}
