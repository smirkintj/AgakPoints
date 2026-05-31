import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, LayoutGrid } from "lucide-react";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date) { return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }
import { SignOutButton } from "@/components/layout/SignOutButton";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const products = await prisma.product.findMany({
    where: { adminId: session.user.id },
    include: {
      members: true,
      pokerSessions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { pokerSessions: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🃏</span>
          <span className="text-lg font-bold text-white">AgakPoints</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/50">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Products</h1>
            <p className="text-white/40 text-sm mt-1">
              Each product has its own team, JIRA connection, and sessions.
            </p>
          </div>
          <Link href="/products/new">
            <Button>
              <Plus className="w-4 h-4" />
              New Product
            </Button>
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed border-white/10">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-5 h-5 text-white/30" />
            </div>
            <h2 className="text-white font-semibold mb-2">No products yet</h2>
            <p className="text-white/40 text-sm mb-6">
              Create a product to connect your team, JIRA sprint, and start estimating.
            </p>
            <Link href="/products/new">
              <Button>
                <Plus className="w-4 h-4" />
                Create your first product
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product: { id: string; name: string; jiraProjectKey: string | null; members: unknown[]; pokerSessions: { createdAt: Date }[]; _count: { members: number; pokerSessions: number } }) => {
              const lastSession = product.pokerSessions[0];
              return (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <Card className="hover:border-violet-500/50 hover:bg-white/8 transition-all cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="group-hover:text-violet-300 transition-colors">
                          {product.name}
                        </CardTitle>
                        {product.jiraProjectKey && (
                          <Badge variant="ghost">{product.jiraProjectKey}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 mt-1 pt-3 border-t border-white/8">
                        <span className="text-xs text-white/40">{product._count.members} members</span>
                        <span className="text-white/20">·</span>
                        <span className="text-xs text-white/40">{product._count.pokerSessions} sessions</span>
                        {lastSession && (
                          <span className="text-xs text-white/30 ml-auto">{fmtDate(new Date(lastSession.createdAt))}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
