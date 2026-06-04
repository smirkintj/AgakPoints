import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductTabs } from "./ProductTabs";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, adminId: session.user.id },
    include: {
      members: { orderBy: { createdAt: "asc" } },
      pokerSessions: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { tickets: true } },
          participants: { where: { checkedIn: true }, select: { id: true } },
          tickets: { select: { status: true, finalEstimate: true } },
        },
      },
    },
  });

  if (!product) notFound();

  const sessions = product.pokerSessions.map((s) => ({
    id: s.id,
    name: s.name,
    sprintName: s.sprintName,
    createdAt: s.createdAt,
    status: s.status,
    _count: s._count,
    estimatedCount: s.tickets.filter((t) => t.status === "ESTIMATED").length,
    totalPts: s.tickets
      .filter((t) => t.status === "ESTIMATED")
      .reduce((sum, t) => sum + (t.finalEstimate ?? 0), 0),
    attendeeCount: s.participants.length,
  }));

  const members = product.members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    capacity: m.capacity,
    country: m.country,
    avatarUrl: m.avatarUrl,
  }));

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-6 py-4 flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
        </div>

        <ProductTabs
          productId={id}
          productName={product.name}
          jiraBaseUrl={product.jiraBaseUrl}
          jiraProjectKey={product.jiraProjectKey}
          jiraEmail={product.jiraEmail}
          jiraApiToken={product.jiraApiToken}
          jiraBoardId={product.jiraBoardId}
          confluenceBaseUrl={product.confluenceBaseUrl}
          confluenceSpaceKey={product.confluenceSpaceKey}
          confluenceEmail={product.confluenceEmail}
          confluenceToken={product.confluenceToken}
          tagPresets={product.tagPresets}
          dependencyTypes={product.dependencyTypes}
          sessions={sessions}
          members={members}
        />
      </main>
    </div>
  );
}
