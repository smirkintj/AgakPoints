import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { adminId: session.user.id },
    include: { members: true, _count: { select: { pokerSessions: true } } },
  });
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, jiraBaseUrl, jiraProjectKey, jiraEmail, jiraApiToken, jiraBoardId,
    confluenceBaseUrl, confluenceSpaceKey, confluenceEmail, confluenceToken,
    members = [],
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      adminId: session.user.id,
      jiraBaseUrl: jiraBaseUrl || null,
      jiraProjectKey: jiraProjectKey || null,
      jiraEmail: jiraEmail || null,
      jiraApiToken: encrypt(jiraApiToken || null),
      jiraBoardId: jiraBoardId || null,
      confluenceBaseUrl: confluenceBaseUrl || null,
      confluenceSpaceKey: confluenceSpaceKey || null,
      confluenceEmail: confluenceEmail || null,
      confluenceToken: encrypt(confluenceToken || null),
      members: {
        create: members
          .filter((m: { name: string }) => m.name?.trim())
          .map((m: { name: string; role: string }) => ({
            name: m.name.trim(),
            role: m.role || "DEV",
          })),
      },
    },
  });

  return NextResponse.json(product);
}
