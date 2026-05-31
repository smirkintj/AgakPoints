import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ParticipantView } from "./ParticipantView";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session = await prisma.pokerSession.findUnique({
    where: { id: sessionId },
    include: {
      tickets: { orderBy: { order: "asc" } },
      product: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!session) notFound();

  return <ParticipantView session={JSON.parse(JSON.stringify(session))} />;
}
