import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { WaitingRoom } from "./WaitingRoom";

export default async function JoinPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: {
      product: { include: { members: { orderBy: { name: "asc" } } } },
      participants: { include: { member: true } },
    },
  });

  if (!session) notFound();

  return <WaitingRoom session={JSON.parse(JSON.stringify(session))} />;
}
