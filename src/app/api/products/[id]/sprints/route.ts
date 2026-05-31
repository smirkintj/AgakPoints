import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchSprints } from "@/lib/jira";
import { decryptProduct } from "@/lib/crypto";

const sprintCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCachedSprints(key: string) {
  const entry = sprintCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedSprints(key: string, data: unknown) {
  sprintCache.set(key, { data, expiresAt: Date.now() + 60_000 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, adminId: session.user.id },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = decryptProduct(product);

  if (!p.jiraBaseUrl || !p.jiraEmail || !p.jiraApiToken || !p.jiraBoardId) {
    return NextResponse.json({ error: "JIRA not configured" }, { status: 400 });
  }

  const cacheKey = `${id}:${p.jiraBoardId}`;
  const cached = getCachedSprints(cacheKey);
  if (cached) return NextResponse.json(cached);

  const sprints = await fetchSprints(
    p.jiraBaseUrl,
    p.jiraEmail,
    p.jiraApiToken,
    p.jiraBoardId
  );
  setCachedSprints(cacheKey, sprints);
  return NextResponse.json(sprints);
}
