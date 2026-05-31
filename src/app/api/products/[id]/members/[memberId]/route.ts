import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ownsProduct(productId: string, userId: string) {
  return prisma.product.findFirst({ where: { id: productId, adminId: userId }, select: { id: true } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: productId, memberId } = await params;
  if (!await ownsProduct(productId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 100);
  if (typeof body.role === "string") data.role = body.role;
  if (typeof body.capacity === "number" && body.capacity >= 1) data.capacity = body.capacity;
  if ("country" in body) data.country = body.country ? String(body.country).slice(0, 10) : null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const member = await prisma.member.update({ where: { id: memberId, productId }, data });
  return NextResponse.json(member);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: productId, memberId } = await params;
  if (!await ownsProduct(productId, session.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.member.delete({ where: { id: memberId, productId } });
  return NextResponse.json({ ok: true });
}
