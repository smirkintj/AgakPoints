import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const product = await prisma.product.findFirst({ where: { id, adminId: session.user.id } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!product.jiraBaseUrl || !product.jiraEmail || !product.jiraApiToken) {
    return NextResponse.json({ ok: false, error: "JIRA credentials not configured" });
  }

  try {
    const credentials = Buffer.from(`${product.jiraEmail}:${product.jiraApiToken}`).toString("base64");
    const res = await fetch(`${product.jiraBaseUrl}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: `JIRA returned ${res.status}: ${text.slice(0, 200)}` });
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, displayName: data.displayName });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
