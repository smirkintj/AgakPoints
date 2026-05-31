"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Award, AlertTriangle, Check, CheckCircle2, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { TicketTypeIcon } from "@/components/session/TicketTypeIcon";
import type { Ticket, Member, SessionParticipant, Vote, PokerSession, Product } from "@/types/models";

type TicketWithVotes = Ticket & { votes: (Vote & { member: Member })[] };
type ParticipantWithMember = SessionParticipant & { member: Member };
type SessionWithDetails = PokerSession & {
  tickets: TicketWithVotes[];
  participants: ParticipantWithMember[];
  product: Product & { members: Member[] };
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDs = (ds: string) => { const d = new Date(ds + "T12:00:00"); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; };

export function SessionSummaryModal({
  session, productId, holidays = [], leaves = []
}: {
  session: SessionWithDetails;
  productId: string;
  holidays?: { date: string; name: string; type: string; country?: string | null }[];
  leaves?: { memberId: string; date: string }[];
}) {
  const router = useRouter();
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryIssueKey, setSummaryIssueKey] = useState("");
  const [summaryState, setSummaryState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncState, setSyncState] = useState<"idle" | "loading" | "done">("idle");
  const [syncResults, setSyncResults] = useState<{ ticketId: string; jiraKey: string; ok: boolean; reason?: string | null }[]>([]);

  const estimatedTickets = session.tickets.filter((t) => t.status === "ESTIMATED");
  const toEstimateTickets = session.tickets.filter((t) => t.status !== "ESTIMATED");
  const attendees = session.participants.filter((p) => p.checkedIn);

  const sprintStart = session.sprintStartDate ? new Date(session.sprintStartDate as unknown as string) : null;
  const sprintEnd = session.sprintEndDate ? new Date(session.sprintEndDate as unknown as string) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-[#0d0b1a] border border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-violet-400" />
              <h2 className="text-xl font-bold text-white">Session Summary</h2>
            </div>
            <p className="text-white/40 text-sm">{session.sprintName}</p>
            {session.name && <p className="text-white/30 text-xs mt-0.5">{session.name}</p>}
          </div>
          <div className="text-right text-xs text-white/30">
            {sprintStart && sprintEnd && (
              <p>{sprintStart.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – {sprintEnd.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</p>
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {/* Sprint info: deploy events, leaves */}
          {(holidays.some((h) => h.type === "DEPLOY") || leaves.length > 0) && (
            <div className="space-y-2">
              {holidays.filter((h) => h.type === "DEPLOY").map((de) => (
                <div key={de.date} className="flex items-center gap-2 text-xs text-violet-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  Deploy: {fmtDs(de.date)}{de.name && de.name !== "Deploy" ? ` — ${de.name}` : ""}
                </div>
              ))}
              {leaves.length > 0 && (() => {
                const leaveByMember: Record<string, string[]> = {};
                for (const l of leaves) {
                  if (!leaveByMember[l.memberId]) leaveByMember[l.memberId] = [];
                  leaveByMember[l.memberId].push(l.date);
                }
                return Object.entries(leaveByMember).map(([mId, dates]) => {
                  const m = session.product.members.find((x) => x.id === mId);
                  if (!m) return null;
                  return (
                    <div key={mId} className="flex items-center gap-2 text-xs text-amber-300/70">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {m.name.split(" ")[0]} on leave: {dates.sort().map(fmtDs).join(", ")}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* Attendance */}
          <div>
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-3">Team · {attendees.length} attended</p>
            <div className="flex flex-wrap gap-3">
              {attendees.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <MemberAvatar name={p.member.name} role={p.member.role} size={22} />
                  <span className="text-xs text-white/70">{p.member.name}</span>
                  <RoleBadge role={p.member.role} size="sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Estimated tickets */}
          <div>
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-3">
              Estimated · {estimatedTickets.length} tickets · {estimatedTickets.reduce((s, t) => s + (t.finalEstimate ?? 0), 0)} pts total
            </p>
            <div className="space-y-1.5">
              {estimatedTickets.map((t) => {
                const assignee = t.assigneeId ? session.product.members.find((m) => m.id === t.assigneeId) : null;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/8">
                    <TicketTypeIcon type={t.issueType} size={12} />
                    <span className="font-mono text-[10px] text-violet-400/70 shrink-0">{t.jiraKey}</span>
                    <span className="text-xs text-white/60 flex-1 truncate">{t.title}</span>
                    {assignee && <MemberAvatar name={assignee.name} role={assignee.role} size={18} />}
                    <span className="font-mono text-xs text-emerald-400 shrink-0">{t.finalEstimate ?? "—"} pts</span>
                    {syncState === "done" && (() => {
                      const r = syncResults.find((x) => x.ticketId === t.id);
                      if (!r) return null;
                      return r.ok
                        ? <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        : <span title={r.reason ?? "Failed"} className="w-3 h-3 text-red-400 shrink-0">✕</span>;
                    })()}
                  </div>
                );
              })}
              {toEstimateTickets.length > 0 && (
                <p className="text-xs text-amber-400/60 pt-1">{toEstimateTickets.length} ticket{toEstimateTickets.length > 1 ? "s" : ""} not estimated</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {syncState === "idle" && (
              <Button variant="ghost" size="sm" onClick={async () => {
                setSyncState("loading");
                const res = await fetch(`/api/sessions/${session.id}/jira-sync`, { method: "POST" });
                const data = await res.json();
                setSyncResults(data.results ?? []);
                setSyncState("done");
              }}>
                <FileText className="w-3.5 h-3.5" />
                Sync to JIRA
              </Button>
            )}
            {syncState === "loading" && <span className="text-xs text-white/40 flex items-center gap-1"><Clock className="w-3 h-3 animate-spin" /> Syncing…</span>}
            {syncState === "done" && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {syncResults.filter((r) => r.ok).length}/{syncResults.length} synced
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/products/${productId}/sessions/${session.id}/host`)}>
              Open full session
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/products/${productId}`)}>
              <Check className="w-3.5 h-3.5" />
              Done
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Post to JIRA modal */}
      {summaryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSummaryModalOpen(false); }}
        >
          <div className="bg-[#111] border border-white/15 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-white font-semibold text-base">Post Sprint Summary to JIRA</h3>
            <input
              type="text"
              placeholder="JIRA issue key (e.g. PROJ-123)"
              value={summaryIssueKey}
              onChange={(e) => setSummaryIssueKey(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none"
              disabled={summaryState === "loading"}
            />
            {summaryState === "success" && (
              <p className="text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Posted successfully!
              </p>
            )}
            {summaryState === "error" && (
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Failed to post. Check the issue key.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="success"
                disabled={!summaryIssueKey.trim() || summaryState === "loading"}
                onClick={async () => {
                  setSummaryState("loading");
                  try {
                    const res = await fetch(`/api/sessions/${session.id}/summary`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ jiraIssueKey: summaryIssueKey.trim() }),
                    });
                    setSummaryState(res.ok ? "success" : "error");
                  } catch {
                    setSummaryState("error");
                  }
                }}
              >
                {summaryState === "loading" ? (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Posting…
                  </span>
                ) : "Post"}
              </Button>
              <Button variant="ghost" onClick={() => setSummaryModalOpen(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
