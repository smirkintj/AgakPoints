import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
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

  // Completed sessions have no join page — host page handles recap
  if (session.status === "COMPLETED") {
    redirect(`/session/${sessionId}`);
  }

  return <WaitingRoom session={JSON.parse(JSON.stringify(session))} />;
}
