import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.pokerSession.findFirst({
    where: { OR: [{ id: sessionId }, { shortCode: sessionId }] },
    include: {
      tickets: {
        orderBy: { order: "asc" },
        select: {
          id: true, sessionId: true, jiraKey: true, title: true, description: true,
          status: true, finalEstimate: true, adminNote: true, order: true,
          assigneeId: true, issueType: true, jiraAssigneeName: true,
          jiraAssigneeAccountId: true, contextNote: true, priority: true,
          designReadiness: true, designComplexity: true, designLink: true, tags: true,
        },
      },
      participants: {
        select: {
          id: true, memberId: true, checkedIn: true,
          member: { select: { id: true, name: true, role: true, capacity: true, country: true, avatarUrl: true } },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          jiraProjectKey: true,
          confluenceSpaceKey: true,
          tagPresets: true,
          dependencyTypes: true,
          members: {
            select: {
              id: true, name: true, role: true, capacity: true, avatarUrl: true,
            },
          },
        },
      },
    },
  });

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();

  const allowed: Record<string, unknown> = {};
  if (typeof body.name === "string") allowed.name = body.name;

  const updated = await prisma.pokerSession.update({ where: { id: sessionId }, data: allowed });
  return NextResponse.json(updated);
}
