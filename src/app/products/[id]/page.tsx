import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { MemberManager } from "./MemberManager";
import { SessionList } from "./SessionList";

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
        include: { _count: { select: { tickets: true } } },
      },
    },
  });

  if (!product) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <Link href={`/products/${id}/sessions/new`}>
          <Button size="sm">
            <Plus className="w-4 h-4" />
            New Session
          </Button>
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            {product.jiraProjectKey && <Badge variant="ghost">JIRA: {product.jiraProjectKey}</Badge>}
            {product.confluenceSpaceKey && <Badge variant="ghost">Confluence: {product.confluenceSpaceKey}</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({product.members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberManager
                productId={id}
                initialMembers={product.members.map((m) => ({
                  id: m.id,
                  name: m.name,
                  role: m.role,
                  capacity: (m as typeof m & { capacity?: number }).capacity ?? 20,
                }))}
              />
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sessions ({product.pokerSessions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <SessionList
                productId={id}
                sessions={product.pokerSessions.map((s) => ({
                  id: s.id,
                  name: s.name,
                  sprintName: s.sprintName,
                  createdAt: s.createdAt,
                  status: s.status,
                  _count: s._count,
                }))}
              />
              {product.pokerSessions.length === 0 && (
                <div className="text-center pt-2">
                  <Link href={`/products/${id}/sessions/new`}>
                    <Button size="sm">Start First Session</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
