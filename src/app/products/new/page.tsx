"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Step = "basics" | "jira" | "confluence" | "members";

interface MemberInput {
  name: string;
  role: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basics");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    jiraBaseUrl: "",
    jiraProjectKey: "",
    jiraEmail: "",
    jiraApiToken: "",
    jiraBoardId: "",
    confluenceBaseUrl: "",
    confluenceSpaceKey: "",
    confluenceEmail: "",
    confluenceToken: "",
  });
  const [members, setMembers] = useState<MemberInput[]>([
    { name: "", role: "DEV" },
  ]);

  const update = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addMember = () => setMembers((m) => [...m, { name: "", role: "DEV" }]);
  const updateMember = (i: number, key: string, value: string) =>
    setMembers((m) => m.map((mb, idx) => (idx === i ? { ...mb, [key]: value } : mb)));
  const removeMember = (i: number) => setMembers((m) => m.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, members: members.filter((m) => m.name.trim()) }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      router.push(`/products/${data.id}`);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ROLES = ["DEV", "QA", "UI_UX", "SM", "TECH_LEAD"];

  return (
    <div className="min-h-screen bg-zinc-950 max-w-2xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">Create Product</h1>
      <p className="text-white/40 text-sm mb-8">Set up your team, JIRA, and Confluence connections.</p>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {(["basics", "jira", "confluence", "members"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s)}
              className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                step === s
                  ? "bg-violet-600 text-white"
                  : "bg-white/10 text-white/40 hover:bg-white/20"
              }`}
            >
              {i + 1}
            </button>
            {i < 3 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === "basics" && "Product Basics"}
            {step === "jira" && "JIRA Connection"}
            {step === "confluence" && "Confluence Connection"}
            {step === "members" && "Team Members"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "basics" && (
            <>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Product Name *</label>
                <Input
                  placeholder="e.g. Platform Squad"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => setStep("jira")}
                disabled={!form.name.trim()}
              >
                Next: JIRA Setup <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {step === "jira" && (
            <>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">JIRA Base URL</label>
                <Input
                  placeholder="https://yourcompany.atlassian.net"
                  value={form.jiraBaseUrl}
                  onChange={(e) => update("jiraBaseUrl", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">JIRA Project Key</label>
                <Input
                  placeholder="e.g. PLAT"
                  value={form.jiraProjectKey}
                  onChange={(e) => update("jiraProjectKey", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Board ID</label>
                <Input
                  placeholder="e.g. 42"
                  value={form.jiraBoardId}
                  onChange={(e) => update("jiraBoardId", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">JIRA Email</label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={form.jiraEmail}
                  onChange={(e) => update("jiraEmail", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">JIRA API Token</label>
                <Input
                  type="password"
                  placeholder="your-api-token"
                  value={form.jiraApiToken}
                  onChange={(e) => update("jiraApiToken", e.target.value)}
                />
                <p className="text-xs text-white/30 mt-1">
                  Generate at: id.atlassian.com/manage-profile/security/api-tokens
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep("basics")} className="flex-1">Back</Button>
                <Button onClick={() => setStep("confluence")} className="flex-1">
                  Next: Confluence <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {step === "confluence" && (
            <>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Confluence Base URL</label>
                <Input
                  placeholder="https://yourcompany.atlassian.net"
                  value={form.confluenceBaseUrl}
                  onChange={(e) => update("confluenceBaseUrl", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Space Key</label>
                <Input
                  placeholder="e.g. TEAM"
                  value={form.confluenceSpaceKey}
                  onChange={(e) => update("confluenceSpaceKey", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Confluence Email</label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={form.confluenceEmail}
                  onChange={(e) => update("confluenceEmail", e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Confluence API Token</label>
                <Input
                  type="password"
                  placeholder="your-api-token"
                  value={form.confluenceToken}
                  onChange={(e) => update("confluenceToken", e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep("jira")} className="flex-1">Back</Button>
                <Button onClick={() => setStep("members")} className="flex-1">
                  Next: Members <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {step === "members" && (
            <>
              <p className="text-sm text-white/40">Add your team members. They&apos;ll check in by name at each session.</p>
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Member name"
                      value={m.name}
                      onChange={(e) => updateMember(i, "name", e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={m.role}
                      onChange={(e) => updateMember(i, "role", e.target.value)}
                      className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r} className="bg-zinc-900">{r}</option>
                      ))}
                    </select>
                    {members.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeMember(i)}>✕</Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" onClick={addMember} className="w-full">+ Add Member</Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep("confluence")} className="flex-1">Back</Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !members.some((m) => m.name.trim())}
                  className="flex-1"
                >
                  {loading ? "Creating..." : "Create Product 🎉"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
