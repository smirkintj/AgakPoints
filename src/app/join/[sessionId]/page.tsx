import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { WaitingRoom } from "./WaitingRoom";

export default async function JoinPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await prisma.pokerSession.findFirst({
    where: { OR: [{ id: sessionId }, { shortCode: sessionId } as any] },
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
