"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, RevealedVote, CheckedInMember } from "@/types/partykit";
import type { Ticket, Member, Product, PokerSession } from "@/types/models";
import { VotingCard } from "@/components/session/VotingCard";
import { RevealCard } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { FIBONACCI_VALUES } from "@/lib/utils";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { TicketTypeIcon } from "@/components/session/TicketTypeIcon";
import { Check, ChevronDown, ChevronRight, Clock, Sparkles, CalendarX } from "lucide-react";

function fireConsensusBurst() {
  const colors = ["#7c3aed", "#a78bfa", "#10b981", "#ffffff", "#4f46e5"];
  confetti({ particleCount: 80, spread: 55, origin: { x: 0.5, y: 0.55 }, colors, scalar: 1.1, gravity: 0.9 });
  setTimeout(() => {
    confetti({ particleCount: 50, spread: 80, origin: { x: 0.5, y: 0.5 }, colors, scalar: 0.9, gravity: 1.1, ticks: 180 });
  }, 150);
}

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#3b82f6", Lowest: "#6b7280",
};
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
import confetti from "canvas-confetti";
import { getAutoReaction } from "@/lib/gameReactions";

type SessionWithDetails = PokerSession & {
  tickets: Ticket[];
  product: Product & { members: Member[] };
};

export function ParticipantView({ session }: { session: SessionWithDetails }) {
  const [member, setMember] = useState<Member | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInMember[]>([]);
  const [sessionStatus, setSessionStatus] = useState<string>(session.status);
  const [currentTicket, setCurrentTicket] = useState<{
    ticketId: string; jiraKey: string; title: string; description?: string;
    contextNote?: string; issueType?: string; priority?: string; deps?: string[];
  } | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [votedMemberIds, setVotedMemberIds] = useState<string[]>([]);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[] | null>(null);
  const revealedVotesRef = useRef<RevealedVote[] | null>(null);
  const [memberVoteHistory, setMemberVoteHistory] = useState<Record<string, { vote: number; final: number }[]>>({});
  const [revealMeta, setRevealMeta] = useState<{ median: number; isConsensus: boolean } | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());
  const [lockedAssignees, setLockedAssignees] = useState<Record<string, string>>({});
  const [ticketEstimates, setTicketEstimates] = useState<Record<string, number>>({});
  const [sessionEnded, setSessionEnded] = useState(false);
  const [autoReaction, setAutoReaction] = useState<{ emoji: string; label: string } | null>(null);
  const [myAssignedOpen, setMyAssignedOpen] = useState(true);
  const [holidays, setHolidays] = useState<{ date: string; name: string; type: string; country?: string | null }[]>([]);
  const [myLeaves, setMyLeaves] = useState<string[]>([]);
  const recapRef = useRef<HTMLDivElement>(null);

  // Design fields (UI/UX only)
  const [ticketDesign, setTicketDesign] = useState<{
    designReadiness: string | null;
    designComplexity: string | null;
    designLink: string | null;
  }>({ designReadiness: null, designComplexity: null, designLink: null });

  // Tags (TECH_LEAD only)
  const [ticketTags, setTicketTags] = useState<string[]>([]);

  // Session health (SM + TECH_LEAD)
  const [sessionHealth, setSessionHealth] = useState({
    ticketsEstimated: 0,
    totalTickets: session.tickets.length,
    consensusCount: 0,
    reEstimateCount: 0,
    avgTimePerTicket: 0,
    ticketStartTime: Date.now(),
    tagDistribution: {} as Record<string, number>,
  });
  const sessionHealthRef = useRef(sessionHealth);
  sessionHealthRef.current = sessionHealth;
  revealedVotesRef.current = revealedVotes;

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (stored) setMember(JSON.parse(stored));
  }, [session.id]);

  useEffect(() => {
    fetch(`/api/sessions/${session.id}/holidays`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { holidays: { date: string; name: string; type: string; country?: string | null }[] }) => setHolidays(d.holidays ?? []))
      .catch(() => {});
  }, [session.id]);

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (!stored) return;
    let mId: string;
    try { mId = JSON.parse(stored).id; } catch { return; }
    if (!mId) return;
    fetch(`/api/sessions/${session.id}/leave?memberId=${mId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { leaves: { memberId: string; date: string }[] }) => {
        setMyLeaves(d.leaves.map((l) => l.date));
      })
      .catch(() => {});
  }, [session.id]);

  const { send } = usePartyRoom(session.id, useCallback((msg: MsgOut) => {
    switch (msg.type) {
      case "STATE_SYNC": {
        const s = msg.state;
        // Only advance session status — never let a stale/evicted PartyKit room downgrade
        // a DB-loaded ACTIVE/COMPLETED status back to WAITING
        const STATUS_RANK: Record<string, number> = { WAITING: 0, ACTIVE: 1, COMPLETED: 2 };
        setSessionStatus((prev) =>
          (STATUS_RANK[s.sessionStatus] ?? 0) >= (STATUS_RANK[prev] ?? 0) ? s.sessionStatus : prev
        );
        setCheckedIn(s.checkedIn);
        setCurrentTicket(s.currentTicket
          ? { ticketId: s.currentTicket.ticketId, jiraKey: s.currentTicket.jiraKey, title: s.currentTicket.title, description: s.currentTicket.description, contextNote: s.currentTicket.contextNote, issueType: s.currentTicket.issueType, priority: s.currentTicket.priority, deps: s.currentTicket.deps }
          : null
        );
        setVotedMemberIds(s.votedMemberIds);
        setRevealedVotes(s.revealedVotes);
        setLockedTickets(new Set(s.lockedTickets));
        setLockedAssignees(s.lockedTicketAssignees ?? {});
        const estMap: Record<string, number> = {};
        for (const t of session.tickets) {
          if (t.status === "ESTIMATED" && t.finalEstimate != null) estMap[t.id] = t.finalEstimate;
        }
        setTicketEstimates(estMap);
        if (s.revealed && s.revealedVotes) {
          const vals = s.revealedVotes.map((v) => v.value);
          const sorted = [...vals].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          setRevealMeta({
            median: sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2),
            isConsensus: new Set(vals).size === 1,
          });
        }
        break;
      }
      case "PRESENCE_UPDATE":
        setCheckedIn(msg.checkedIn);
        break;
      case "TICKET_OPENED": {
        const wasEstimated = session.tickets.find((t) => t.id === msg.ticketId)?.status === "ESTIMATED";
        setCurrentTicket({ ticketId: msg.ticketId, jiraKey: msg.jiraKey, title: msg.title, description: msg.description, contextNote: msg.contextNote, issueType: msg.issueType, priority: msg.priority, deps: msg.deps });
        setMyVote(null);
        setVotedMemberIds([]);
        setRevealedVotes(null);
        setRevealMeta(null);
        setTicketDesign({ designReadiness: null, designComplexity: null, designLink: null });
        setTicketTags([]);
        setSessionHealth((prev) => ({
          ...prev,
          ticketStartTime: Date.now(),
          reEstimateCount: wasEstimated ? prev.reEstimateCount + 1 : prev.reEstimateCount,
        }));
        break;
      }
      case "VOTE_PROGRESS":
        setVotedMemberIds(msg.votedMemberIds);
        break;
      case "VOTES_REVEALED":
        setRevealedVotes(msg.votes);
        setRevealMeta({ median: msg.median, isConsensus: msg.isConsensus });
        if (msg.isConsensus) {
          fireConsensusBurst();
          setSessionHealth((prev) => ({ ...prev, consensusCount: prev.consensusCount + 1 }));
        }
        {
          const ar = getAutoReaction(msg.votes.map((v) => v.value));
          setAutoReaction(ar);
          if (ar) setTimeout(() => setAutoReaction(null), 4000);
        }
        break;
      case "ESTIMATE_LOCKED":
        setLockedTickets((l) => new Set([...l, msg.ticketId]));
        if (msg.assigneeId) setLockedAssignees((a) => ({ ...a, [msg.ticketId]: msg.assigneeId! }));
        setSessionHealth((prev) => {
          const elapsed = (Date.now() - prev.ticketStartTime) / 1000;
          const newEstimated = prev.ticketsEstimated + 1;
          const newAvg = (prev.avgTimePerTicket * prev.ticketsEstimated + elapsed) / newEstimated;
          return { ...prev, ticketsEstimated: newEstimated, avgTimePerTicket: newAvg };
        });
        setTicketEstimates((e) => ({ ...e, [msg.ticketId]: msg.value }));
        {
          const votes = revealedVotesRef.current;
          if (votes) {
            setMemberVoteHistory((prev) => {
              const next = { ...prev };
              for (const v of votes) {
                const entry = { vote: v.value, final: msg.value };
                next[v.memberId] = [...(next[v.memberId] ?? []), entry].slice(-5);
              }
              return next;
            });
          }
        }
        setCurrentTicket(null);
        break;
      case "TICKET_DESIGN_UPDATED":
        setTicketDesign((d) => ({
          ...d,
          ...(msg.designReadiness !== undefined && { designReadiness: msg.designReadiness ?? null }),
          ...(msg.designComplexity !== undefined && { designComplexity: msg.designComplexity ?? null }),
          ...(msg.designLink !== undefined && { designLink: msg.designLink ?? null }),
        }));
        break;
      case "TICKET_TAGS_UPDATED":
        setTicketTags(msg.tags);
        setSessionHealth((prev) => {
          const dist = { ...prev.tagDistribution };
          for (const tag of msg.tags) { dist[tag] = (dist[tag] ?? 0) + 1; }
          return { ...prev, tagDistribution: dist };
        });
        break;
      case "REACTION_RECEIVED":
        setReactions((r) => [...r.slice(-20), msg]);
        break;
      case "NOTE_UPDATED":
        setCurrentTicket((prev) => prev && prev.ticketId === msg.ticketId ? { ...prev, contextNote: msg.note } : prev);
        break;
      case "LEAVE_UPDATED": {
        const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
        if (!stored) break;
        let myId: string;
        try { myId = JSON.parse(stored).id; } catch { break; }
        if (msg.memberId !== myId) break;
        setMyLeaves((prev) =>
          msg.active ? [...prev.filter((d) => d !== msg.date), msg.date] : prev.filter((d) => d !== msg.date)
        );
        break;
      }
      case "SESSION_ENDED":
        setSessionEnded(true);
        break;
      case "MEMBER_KICKED":
        if (member && msg.memberId === member.id) {
          sessionStorage.removeItem(`agakpoints_member_${session.id}`);
          window.location.href = `/join/${session.id}`;
        }
        break;
    }
  }, [member, session.id, session.tickets]));

  const PRESET_TAGS = session.product.tagPresets?.length
    ? session.product.tagPresets
    : ["backend", "frontend", "infra", "data-migration", "third-party", "auth", "performance"];

  const updateDesign = async (patch: Partial<{ designReadiness: string | null; designComplexity: string | null; designLink: string | null }>) => {
    if (!currentTicket) return;
    setTicketDesign((d) => ({ ...d, ...patch }));
    send({ type: "UPDATE_TICKET_DESIGN", ticketId: currentTicket.ticketId, ...patch });
    await fetch(`/api/sessions/${session.id}/tickets/${currentTicket.ticketId}/design`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const updateTags = async (tags: string[]) => {
    if (!currentTicket) return;
    setTicketTags(tags);
    send({ type: "UPDATE_TICKET_TAGS", ticketId: currentTicket.ticketId, tags });
    await fetch(`/api/sessions/${session.id}/tickets/${currentTicket.ticketId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
  };

  const castVote = useCallback((value: number) => {
    if (!member || myVote !== null || !currentTicket || revealedVotes) return;
    setMyVote(value);
    send({ type: "VOTE_CAST", memberId: member.id, value });
  }, [member, myVote, currentTicket, revealedVotes, send]);

  const sendReaction = useCallback((emoji: string) => {
    if (!member) return;
    send({ type: "REACTION", memberId: member.id, memberName: member.name, emoji });
  }, [member, send]);

  const myLoad = member ? Object.entries(lockedAssignees)
    .filter(([, mId]) => mId === member.id)
    .reduce((sum, [ticketId]) => sum + (ticketEstimates[ticketId] ?? 0), 0) : 0;

  const myAssigned = member
    ? Object.entries(lockedAssignees)
        .filter(([, mId]) => mId === member.id)
        .map(([ticketId]) => ({
          ticket: session.tickets.find((t) => t.id === ticketId),
          sp: ticketEstimates[ticketId] ?? 0,
        }))
        .filter((x) => x.ticket)
    : [];

  const sprintStart = session.sprintStartDate ? new Date(session.sprintStartDate as unknown as string) : null;
  const sprintEnd = session.sprintEndDate ? new Date(session.sprintEndDate as unknown as string) : null;
  const fmtDateStr = (ds: string) => { const d = new Date(ds + "T12:00:00"); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; };
  const phDuringSprint = holidays.filter((h) => {
    if (h.type !== "PH") return false;
    const hCountry = h.country;
    if (!hCountry) return true; // applies to all
    return member?.country === hCountry;
  });
  const deployEvents = holidays.filter((h) => h.type === "DEPLOY");

  const formatDate = (d: Date) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  const workingDays = (() => {
    if (!sprintStart || !sprintEnd) return null;
    let count = 0;
    const cur = new Date(sprintStart);
    while (cur <= sprintEnd) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count - phDuringSprint.length;
  })();

  if (!member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-5 h-5 text-white/40" />
          </div>
          <p className="text-white/60 mb-4">Who are you?</p>
          <a href={`/join/${session.id}`} className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            Go back to check-in
          </a>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    const totalSP = myAssigned.reduce((s, x) => s + x.sp, 0);
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div>
            <div className="w-12 h-12 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Session Ended</h2>
            <p className="text-white/40 text-sm mt-1">{session.name ?? session.sprintName}</p>
          </div>
          <div ref={recapRef} className="space-y-4">
            {myAssigned.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Your assignments</p>
                  <span className="text-sm font-bold text-violet-400 font-mono">{totalSP} SP total</span>
                </div>
                <div className="space-y-2">
                  {myAssigned.map(({ ticket, sp }) => ticket && (
                    <div key={ticket.id} className="py-1.5 border-b border-white/8 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-violet-400/70 shrink-0">{ticket.jiraKey}</span>
                        <span className="text-xs font-mono text-emerald-400 shrink-0">{sp} pts</span>
                      </div>
                      <p className="text-sm text-white/70 mt-0.5">{ticket.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-white/30 text-sm">No tickets assigned to you this sprint.</p>
            )}
            <button
              onClick={async () => {
                if (!recapRef.current) return;
                const { toPng } = await import("html-to-image");
                const url = await toPng(recapRef.current, { backgroundColor: "#0d0b1a" });
                const a = document.createElement("a");
                a.href = url;
                a.download = `${session.sprintName}-recap.png`;
                a.click();
              }}
              className="text-xs text-white/25 hover:text-violet-400 border border-white/8 hover:border-violet-500/30 rounded-lg px-4 py-2 transition-colors"
            >
              Save as image
            </button>
          </div>
        </div>
      </div>
    );
  }

  const NON_VOTING = ["UI_UX", "SM", "TECH_LEAD"];
  const isObserver = NON_VOTING.includes(member.role);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MemberAvatar name={member.name} role={member.role} size={28} showRing />
          <p className="text-white text-sm font-semibold leading-tight">{member.name}</p>
        </div>
        {myLoad > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/8 border border-white/15 text-xs">
            <span className="text-white/40">Load:</span>
            <span className="text-white font-mono font-bold">{myLoad} SP</span>
          </div>
        )}
      </header>

      {/* Sprint Info — always visible */}
      <div className="border-b border-white/8 px-4 py-3 shrink-0 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Session</p>
            <p className="text-white font-semibold text-sm leading-tight">{session.name ?? session.sprintName}</p>
          </div>
          <div className="w-px h-8 bg-white/10 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Sprint</p>
            <p className="text-white/80 text-sm leading-tight">{session.sprintName}</p>
          </div>
          {sprintStart && sprintEnd && (
            <>
              <div className="w-px h-8 bg-white/10 shrink-0" />
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Duration</p>
                <p className="text-white/80 text-sm leading-tight">
                  {formatDate(sprintStart)} – {formatDate(sprintEnd)}
                  {workingDays != null && <span className="text-white/50 ml-1">· {workingDays} WDs</span>}
                </p>
              </div>
            </>
          )}
        </div>
        {(phDuringSprint.length > 0 || myLeaves.length > 0 || deployEvents.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {phDuringSprint.map((h) => (
              <span key={h.date} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-300">
                🏖️ PH: {fmtDateStr(h.date)} {h.name}
              </span>
            ))}
            {deployEvents.map((de) => (
              <span key={de.date} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">
                🚀 Deploy: {fmtDateStr(de.date)}
              </span>
            ))}
            {myLeaves.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                <CalendarX className="w-3 h-3" />
                AL: {myLeaves.sort().map(fmtDateStr).join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main area */}
      <main className="flex-1 flex flex-col items-center px-4 py-6 gap-5 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!currentTicket ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center flex-1 flex flex-col items-center justify-center gap-4 w-full">
              <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto">
                <Clock className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {sessionStatus === "ACTIVE" ? "Session in progress" : "Waiting for host"}
                </h2>
                <p className="text-white/40 text-sm">
                  {sessionStatus === "ACTIVE" ? "Host is selecting the next ticket..." : "The host will start the session shortly."}
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              {checkedIn.length > 1 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {checkedIn.filter((c) => c.memberId !== member.id).map((c) => (
                    <span key={c.memberId} className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/40">
                      {c.memberName}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={currentTicket.ticketId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="w-full max-w-lg space-y-4"
            >
              {/* ── Ticket card ── */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 space-y-3">
                {/* Type + key + priority */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TicketTypeIcon type={currentTicket.issueType} size={13} />
                    <span className="text-white/40 text-xs">{currentTicket.issueType ?? "Story"}</span>
                    <span className="text-white/20 text-xs">·</span>
                    <span className="font-mono text-violet-400 text-xs font-semibold">{currentTicket.jiraKey}</span>
                  </div>
                  {currentTicket.priority && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: PRIORITY_COLORS[currentTicket.priority] ?? "#6b7280", backgroundColor: (PRIORITY_COLORS[currentTicket.priority] ?? "#6b7280") + "22" }}>
                      {currentTicket.priority}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-lg font-bold text-white leading-snug">{currentTicket.title}</h2>

                {currentTicket.description && (
                  <p className="text-sm text-white/50 leading-relaxed border-t border-white/8 pt-3">
                    {currentTicket.description}
                  </p>
                )}

                {/* Host note */}
                {currentTicket.contextNote && (
                  <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2.5">
                    <p className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-widest mb-1">Host note</p>
                    <p className="text-sm text-white/60 leading-relaxed">{currentTicket.contextNote}</p>
                  </div>
                )}

                {/* Dependencies */}
                {currentTicket.deps && currentTicket.deps.length > 0 && (
                  <div className="border-t border-white/8 pt-3">
                    <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-2">Dependencies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentTicket.deps.map((dep) => (
                        <span key={dep} className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-amber-500/40 bg-amber-500/12 text-amber-300">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Voting ── */}
              {!revealedVotes && (() => {
                if (isObserver) {
                  // UI/UX gets design panel
                  if (member.role === "UI_UX") {
                    return (
                      <div className="space-y-4 rounded-xl border border-white/10 bg-white/3 px-4 py-4">
                        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Design Info</p>
                        {/* Design Readiness */}
                        <div>
                          <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Readiness</p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { value: "READY", label: "Ready", activeClass: "bg-emerald-600/25 border-emerald-400/50 text-emerald-300" },
                              { value: "IN_PROGRESS", label: "In Progress", activeClass: "bg-amber-600/25 border-amber-400/50 text-amber-300" },
                              { value: "NOT_STARTED", label: "Not Started", activeClass: "bg-red-600/25 border-red-400/50 text-red-300" },
                              { value: "N/A", label: "N/A", activeClass: "bg-white/15 border-white/30 text-white/60" },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => updateDesign({ designReadiness: opt.value === "N/A" ? null : opt.value })}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                                  (opt.value === "N/A" ? ticketDesign.designReadiness === null : ticketDesign.designReadiness === opt.value)
                                    ? opt.activeClass
                                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Design Complexity */}
                        <div>
                          <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Complexity</p>
                          <div className="flex gap-2">
                            {[
                              { value: "LOW", label: "Low" },
                              { value: "MEDIUM", label: "Medium" },
                              { value: "HIGH", label: "High" },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => updateDesign({ designComplexity: opt.value })}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                                  ticketDesign.designComplexity === opt.value
                                    ? "bg-violet-600/30 border-violet-400/50 text-violet-300"
                                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Design Link */}
                        <div>
                          <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Link</p>
                          <input
                            type="url"
                            placeholder="https://figma.com/..."
                            value={ticketDesign.designLink ?? ""}
                            onChange={e => setTicketDesign(d => ({ ...d, designLink: e.target.value }))}
                            onBlur={e => updateDesign({ designLink: e.target.value || null })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
                          />
                          {ticketDesign.designLink && (
                            <a href={ticketDesign.designLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline mt-1 inline-block">
                              Open design ↗
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  }
                  // SM + TECH_LEAD get health panel
                  if (member.role === "SM" || member.role === "TECH_LEAD") {
                    return (
                      <div className="space-y-4 py-2 w-full">
                        <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Session Health</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <p className="text-[10px] text-white/40 mb-1">Estimated</p>
                            <p className="text-lg font-bold text-white">{sessionHealth.ticketsEstimated}<span className="text-white/30 text-sm">/{sessionHealth.totalTickets}</span></p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <p className="text-[10px] text-white/40 mb-1">Consensus Rate</p>
                            <p className="text-lg font-bold text-emerald-400">
                              {sessionHealth.ticketsEstimated > 0 ? Math.round((sessionHealth.consensusCount / sessionHealth.ticketsEstimated) * 100) : 0}%
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <p className="text-[10px] text-white/40 mb-1">Avg Time</p>
                            <p className="text-lg font-bold text-white">
                              {sessionHealth.ticketsEstimated > 0 ? Math.round(sessionHealth.avgTimePerTicket / 60) : "—"}<span className="text-white/30 text-sm">m</span>
                            </p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <p className="text-[10px] text-white/40 mb-1">Re-estimates</p>
                            <p className="text-lg font-bold text-amber-400">{sessionHealth.reEstimateCount}</p>
                          </div>
                        </div>
                        {/* Waiting on */}
                        {votedMemberIds.length < checkedIn.length && (
                          <div>
                            <p className="text-[10px] text-white/30 mb-2">Waiting on</p>
                            <div className="flex flex-wrap gap-2">
                              {checkedIn.filter(c => !votedMemberIds.includes(c.memberId)).map(c => (
                                <span key={c.memberId} className="text-xs text-white/50 px-2 py-0.5 bg-white/5 rounded-full border border-white/10">
                                  {c.memberName.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* TL-only: tags panel + tag distribution */}
                        {member.role === "TECH_LEAD" && (
                          <div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {PRESET_TAGS.map(tag => {
                                const active = ticketTags.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => updateTags(active ? ticketTags.filter(t => t !== tag) : [...ticketTags, tag])}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                                      active
                                        ? "bg-violet-600/25 border-violet-400/40 text-violet-300"
                                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                    }`}
                                  >
                                    #{tag}
                                  </button>
                                );
                              })}
                            </div>
                            {Object.keys(sessionHealth.tagDistribution).length > 0 && (
                              <div>
                                <p className="text-[10px] text-white/30 mb-2">Sprint Tag Breakdown</p>
                                <div className="space-y-1">
                                  {Object.entries(sessionHealth.tagDistribution)
                                    .sort(([,a],[,b]) => b - a)
                                    .map(([tag, count]) => (
                                      <div key={tag} className="flex items-center justify-between">
                                        <span className="text-xs font-mono text-white/50">#{tag}</span>
                                        <span className="text-xs text-violet-300 font-bold">{count}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  // Default observer (shouldn't reach here for the above roles)
                  return (
                    <div className="text-center py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/8 border border-white/15 text-xs text-white/40 font-medium">
                        Observing
                      </span>
                      <p className="text-white/25 text-xs mt-2">Your role doesn&apos;t vote — watching the estimates come in</p>
                    </div>
                  );
                }
                if (myVote !== null) {
                  return (
                    <div className="text-center py-6">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/15 border border-violet-500/30">
                        <span className="text-2xl font-bold text-violet-300 font-mono">{myVote}</span>
                        <span className="text-white/40 text-sm">— waiting for reveal...</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3 pt-2">
                    <p className="text-center text-white/40 text-sm">Pick your estimate</p>
                    <div className="flex gap-2.5 justify-center flex-wrap">
                      {FIBONACCI_VALUES.map((v) => (
                        <VotingCard key={v} value={v} selected={false} disabled={false} onSelect={castVote} />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Vote progress dots */}
              {!revealedVotes && (
                <div className="flex justify-center gap-2">
                  {checkedIn.map((c) => {
                    const hasVoted = votedMemberIds.includes(c.memberId);
                    return (
                      <div key={c.memberId} title={c.memberName}>
                        <MemberAvatar name={c.memberName} role={c.role} size={32} showRing={hasVoted} dimmed={!hasVoted} />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Revealed */}
              {revealedVotes && revealMeta && (
                <div className="space-y-5">
                  {/* Auto reaction pill */}
                  <AnimatePresence>
                    {autoReaction && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white font-semibold text-sm mx-auto w-fit"
                      >
                        <span className="text-xl">{autoReaction.emoji}</span>
                        {autoReaction.label}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {revealedVotes.map((vote, i) => {
                      const voter = checkedIn.find((c) => c.memberId === vote.memberId);
                      return (
                        <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value} median={revealMeta.median} delay={i * 0.08} role={voter?.role} voteHistory={memberVoteHistory[vote.memberId] ?? []} />
                      );
                    })}
                  </div>
                  <div className="text-center text-sm text-white/40">
                    Median: <span className="text-white font-bold">{revealMeta.median}</span>
                    {revealMeta.isConsensus && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" /> Consensus
                      </span>
                    )}
                  </div>
                  <div className="border-t border-white/10 pt-3 flex justify-center">
                    <EmojiReaction reactions={reactions} onReact={sendReaction} emojis={["👍", "🤔", "🔥", "💀"]} />
                  </div>
                </div>
              )}

              {/* ── Design panel (UI/UX, always shown when ticket is active — also post-reveal) ── */}
              {member.role === "UI_UX" && revealedVotes && (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/3 px-4 py-4">
                  <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Design Info</p>
                  <div>
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Readiness</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: "READY", label: "Ready", activeClass: "bg-emerald-600/25 border-emerald-400/50 text-emerald-300" },
                        { value: "IN_PROGRESS", label: "In Progress", activeClass: "bg-amber-600/25 border-amber-400/50 text-amber-300" },
                        { value: "NOT_STARTED", label: "Not Started", activeClass: "bg-red-600/25 border-red-400/50 text-red-300" },
                        { value: "N/A", label: "N/A", activeClass: "bg-white/15 border-white/30 text-white/60" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateDesign({ designReadiness: opt.value === "N/A" ? null : opt.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                            (opt.value === "N/A" ? ticketDesign.designReadiness === null : ticketDesign.designReadiness === opt.value)
                              ? opt.activeClass
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Complexity</p>
                    <div className="flex gap-2">
                      {[
                        { value: "LOW", label: "Low" },
                        { value: "MEDIUM", label: "Medium" },
                        { value: "HIGH", label: "High" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateDesign({ designComplexity: opt.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                            ticketDesign.designComplexity === opt.value
                              ? "bg-violet-600/30 border-violet-400/50 text-violet-300"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Design Link</p>
                    <input
                      type="url"
                      placeholder="https://figma.com/..."
                      value={ticketDesign.designLink ?? ""}
                      onChange={e => setTicketDesign(d => ({ ...d, designLink: e.target.value }))}
                      onBlur={e => updateDesign({ designLink: e.target.value || null })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
                    />
                    {ticketDesign.designLink && (
                      <a href={ticketDesign.designLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:underline mt-1 inline-block">
                        Open design ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── SM / TECH_LEAD health panel (post-reveal) ── */}
              {(member.role === "SM" || member.role === "TECH_LEAD") && revealedVotes && (
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 px-4 py-4">
                  <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest">Session Health</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-[10px] text-white/40 mb-1">Estimated</p>
                      <p className="text-lg font-bold text-white">{sessionHealth.ticketsEstimated}<span className="text-white/30 text-sm">/{sessionHealth.totalTickets}</span></p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-[10px] text-white/40 mb-1">Consensus Rate</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {sessionHealth.ticketsEstimated > 0 ? Math.round((sessionHealth.consensusCount / sessionHealth.ticketsEstimated) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {lockedTickets.has(currentTicket.ticketId) && (
                <p className="text-center text-emerald-400 text-sm font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> Estimate locked by host
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── My assigned tickets panel ── */}
        {myAssigned.length > 0 && (
          <div className="w-full max-w-lg mt-auto">
            <button
              onClick={() => setMyAssignedOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-t-xl border border-white/10 bg-white/4 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              {myAssignedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="font-medium uppercase tracking-widest">Your tickets</span>
              <span className="ml-auto font-mono text-emerald-400 font-semibold">{myLoad} SP</span>
            </button>
            <AnimatePresence initial={false}>
              {myAssignedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="border border-t-0 border-white/10 rounded-b-xl bg-white/3 divide-y divide-white/6">
                    {myAssigned.map(({ ticket, sp }) => ticket && (
                      <div key={ticket.id} className="flex items-center gap-3 px-3 py-2.5">
                        <TicketTypeIcon type={ticket.issueType} size={12} />
                        <span className="text-xs font-mono text-violet-400/70 shrink-0">{ticket.jiraKey}</span>
                        <span className="text-xs text-white/60 flex-1 truncate">{ticket.title}</span>
                        <span className="text-xs font-mono text-emerald-400 shrink-0">{sp} pts</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
