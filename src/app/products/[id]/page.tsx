import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ExternalLink } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  DEV: "default",
  QA: "success",
  UI_UX: "warning",
  SM: "danger",
  TECH_LEAD: "ghost",
};

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
          _count: { select: { tickets: true, participants: true } },
        },
      },
    },
  });

  if (!product) notFound();

  return (
    <div className="min-h-screen bg-zinc-950">
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
            {product.jiraProjectKey && (
              <Badge variant="ghost">JIRA: {product.jiraProjectKey}</Badge>
            )}
            {product.confluenceSpaceKey && (
              <Badge variant="ghost">Confluence: {product.confluenceSpaceKey}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members ({product.members.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {product.members.map((m: { id: string; name: string; role: string }) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-bold text-violet-300">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-white text-sm">{m.name}</span>
                    </div>
                    <Badge variant={ROLE_COLORS[m.role] as "default" | "success" | "warning" | "danger" | "ghost"}>
                      {m.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions ({product.pokerSessions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {product.pokerSessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm mb-4">No sessions yet</p>
                  <Link href={`/products/${id}/sessions/new`}>
                    <Button size="sm">Start First Session</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {product.pokerSessions.map((s: { id: string; sprintName: string; createdAt: Date; status: string; _count: { tickets: number } }) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{s.sprintName}</p>
                        <p className="text-white/40 text-xs">
                          {new Date(s.createdAt).toLocaleDateString()} • {s._count.tickets} tickets
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            s.status === "COMPLETED" ? "success" :
                            s.status === "ACTIVE" ? "warning" : "ghost"
                          }
                        >
                          {s.status}
                        </Badge>
                        {s.status !== "COMPLETED" && (
                          <Link href={`/products/${id}/sessions/${s.id}/host`}>
                            <Button size="sm" variant="ghost">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
