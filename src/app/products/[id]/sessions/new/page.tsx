"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

interface Sprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export default function NewSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Sprint | null>(null);
  const [error, setError] = useState("");
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    fetch(`/api/products/${id}/sprints`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSprints(data);
      })
      .catch(() => setError("Failed to load sprints"))
      .finally(() => setLoading(false));
  }, [id]);

  const createSession = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: id,
          sprintId: selected.id,
          sprintName: selected.name,
          sprintStartDate: selected.startDate,
          sprintEndDate: selected.endDate,
          name: sessionName || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      router.push(`/products/${id}/sessions/${data.id}/host`);
    } catch {
      setError("Failed to create session");
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-6 py-10">
      <Link href={`/products/${id}`} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Product
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">New Session</h1>
      <p className="text-white/40 text-sm mb-8">Pick a JIRA sprint to load tickets from.</p>

      <Card>
        <CardHeader>
          <CardTitle>Select Sprint</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-3 text-white/40 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading sprints from JIRA...
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
              {error}. {error.includes("JIRA") ? "Check your JIRA configuration in product settings." : ""}
            </div>
          )}
          {!loading && !error && sprints.length === 0 && (
            <p className="text-white/40 text-sm text-center py-8">No active sprints found.</p>
          )}
          {!loading && sprints.length > 0 && (
            <div className="space-y-2">
              {sprints.map((sprint) => (
                <button
                  key={sprint.id}
                  onClick={() => setSelected(sprint)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selected?.id === sprint.id
                      ? "border-violet-500 bg-violet-600/10"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{sprint.name}</p>
                      {sprint.startDate && (
                        <p className="text-white/40 text-xs mt-1">
                          {new Date(sprint.startDate).toLocaleDateString()} →{" "}
                          {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : "TBD"}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      sprint.state === "active" ? "bg-emerald-600/20 text-emerald-400" : "bg-white/10 text-white/40"
                    }`}>
                      {sprint.state}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-white/40 block mb-1">Session name (optional)</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g. Sprint 34 Refinement"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
          )}
          {selected && (
            <Button onClick={createSession} disabled={creating} className="w-full mt-3">
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading tickets...</>
              ) : (
                `Start Session — ${selected.name} 🚀`
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
