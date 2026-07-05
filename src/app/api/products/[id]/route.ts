import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Only the admin of this product may update it
  const product = await prisma.product.findFirst({ where: { id, adminId: session.user.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const allowedFields = [
    "name",
    "jiraBaseUrl",
    "jiraProjectKey",
    "jiraEmail",
    "jiraApiToken",
    "jiraBoardId",
    "confluenceBaseUrl",
    "confluenceSpaceKey",
    "confluenceEmail",
    "confluenceToken",
    "tagPresets",
    "dependencyTypes",
  ];

  const credentialFields = new Set(["jiraApiToken", "confluenceToken"]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in body) {
      data[key] = credentialFields.has(key) ? encrypt(body[key] || null) : body[key];
    }
  }

  const updated = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(updated);
}
