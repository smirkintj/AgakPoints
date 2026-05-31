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

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#3b82f6", Lowest: "#6b7280",
};
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
import confetti from "canvas-confetti";

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
  const [revealMeta, setRevealMeta] = useState<{ median: number; isConsensus: boolean } | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());
  const [lockedAssignees, setLockedAssignees] = useState<Record<string, string>>({});
  const [ticketEstimates, setTicketEstimates] = useState<Record<string, number>>({});
  const [sessionEnded, setSessionEnded] = useState(false);
  const [myAssignedOpen, setMyAssignedOpen] = useState(true);
  const [holidays, setHolidays] = useState<{ date: string; name: string; type: string }[]>([]);
  const [myLeaves, setMyLeaves] = useState<string[]>([]);
  const recapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (stored) setMember(JSON.parse(stored));
  }, [session.id]);

  useEffect(() => {
    fetch(`/api/sessions/${session.id}/holidays`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { holidays: { date: string; name: string; type: string }[] }) => setHolidays(d.holidays ?? []))
      .catch(() => {});
  }, [session.id]);

  useEffect(() => {
    const fetchLeaves = () => {
      const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
      if (!stored) { console.log("[leave] no member in sessionStorage"); return; }
      let mId: string;
      try { mId = JSON.parse(stored).id; } catch { return; }
      if (!mId) { console.log("[leave] no id in stored member"); return; }
      console.log("[leave] fetching for memberId", mId);
      fetch(`/api/sessions/${session.id}/leave?memberId=${mId}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { leaves: { memberId: string; date: string }[] }) => {
          console.log("[leave] response", d);
          setMyLeaves(d.leaves.map((l) => l.date));
        })
        .catch((e) => console.error("[leave] fetch error", e));
    };
    fetchLeaves();
    const id = setInterval(fetchLeaves, 5000);
    return () => clearInterval(id);
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
      case "TICKET_OPENED":
        setCurrentTicket({ ticketId: msg.ticketId, jiraKey: msg.jiraKey, title: msg.title, description: msg.description, contextNote: msg.contextNote, issueType: msg.issueType, priority: msg.priority, deps: msg.deps });
        setMyVote(null);
        setVotedMemberIds([]);
        setRevealedVotes(null);
        setRevealMeta(null);
        break;
      case "VOTE_PROGRESS":
        setVotedMemberIds(msg.votedMemberIds);
        break;
      case "VOTES_REVEALED":
        setRevealedVotes(msg.votes);
        setRevealMeta({ median: msg.median, isConsensus: msg.isConsensus });
        if (msg.isConsensus) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        break;
      case "ESTIMATE_LOCKED":
        setLockedTickets((l) => new Set([...l, msg.ticketId]));
        if (msg.assigneeId) setLockedAssignees((a) => ({ ...a, [msg.ticketId]: msg.assigneeId! }));
        setTicketEstimates((e) => ({ ...e, [msg.ticketId]: msg.value }));
        setCurrentTicket(null);
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
  const phDuringSprint = holidays.filter((h) => h.type === "PH");
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
                🏖️ {h.date} {h.name}
              </span>
            ))}
            {deployEvents.map((de) => {
              const fmtDs = (ds: string) => { const d = new Date(ds + "T12:00:00"); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; };
              return (
                <span key={de.date} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300">
                  🚀 Deploy {fmtDs(de.date)}
                </span>
              );
            })}
            {myLeaves.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                <CalendarX className="w-3 h-3" />
                On leave: {myLeaves.sort().map(ds => { const d = new Date(ds + "T12:00:00"); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }).join(", ")}
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
                  <div className="flex flex-wrap gap-3 justify-center">
                    {revealedVotes.map((vote, i) => {
                      const voter = checkedIn.find((c) => c.memberId === vote.memberId);
                      return (
                        <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value} median={revealMeta.median} delay={i * 0.08} role={voter?.role} />
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
                    <EmojiReaction reactions={reactions} onReact={sendReaction} />
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
