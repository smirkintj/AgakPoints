import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: productId, memberId } = await params;

  const product = await prisma.product.findFirst({
    where: { id: productId, adminId: session.user.id },
  });
  if (!product) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { capacity } = await req.json();
  if (typeof capacity !== "number" || capacity < 1) {
    return NextResponse.json({ error: "Invalid capacity" }, { status: 400 });
  }

  const member = await prisma.member.update({
    where: { id: memberId, productId },
    data: { capacity },
  });

  return NextResponse.json(member);
}
