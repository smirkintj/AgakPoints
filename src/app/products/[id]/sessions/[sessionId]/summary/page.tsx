import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionSummaryModal } from "./SessionSummaryModal";

export default async function SessionSummaryPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id, sessionId } = await params;

  const pokerSession = await prisma.pokerSession.findFirst({
    where: { id: sessionId, product: { adminId: session.user.id } },
    include: {
      tickets: { orderBy: { order: "asc" }, include: { votes: { include: { member: true } } } },
      participants: { include: { member: true } },
      product: { include: { members: true } },
    },
  });

  if (!pokerSession) notFound();

  return (
    <SessionSummaryModal
      session={JSON.parse(JSON.stringify(pokerSession))}
      productId={id}
    />
  );
}
