import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: productId } = await params;
  const product = await prisma.product.findFirst({ where: { id: productId, adminId: session.user.id } });
  if (!product) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const role = typeof body.role === "string" ? body.role : "DEV";
  const country = typeof body.country === "string" ? body.country.slice(0, 10) : null;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const member = await prisma.member.create({ data: { productId, name, role, country } });
  return NextResponse.json(member);
}
