"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, CheckedInMember, RevealedVote, PublicState } from "@/types/partykit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealCard } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { AssignmentPicker } from "@/components/session/AssignmentPicker";
import { BandwidthRail, type SessionLogEntry } from "@/components/session/BandwidthRail";
import { BulkAssignDrawer } from "@/components/session/BulkAssignDrawer";
import { TicketTypeIcon } from "@/components/session/TicketTypeIcon";
import { SprintCalendar } from "@/components/session/SprintCalendar";
import type { Ticket, Member, SessionParticipant, Vote } from "@/types/models";
import { FIBONACCI_VALUES } from "@/lib/utils";
import {
  AlertTriangle, Award, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Copy, Eye, ExternalLink,
  GitMerge, Layers, Lock, Play, RefreshCw, Sparkles, Users, FileText,
} from "lucide-react";
import confetti from "canvas-confetti";

type TicketWithVotes = Ticket & { votes: (Vote & { member: Member })[] };
type ParticipantWithMember = SessionParticipant & { member: Member };

interface PokerSession {
  id: string;
  name?: string | null;
  shortCode?: string | null;
  sprintName: string;
  sprintStartDate: Date | string | null;
  sprintEndDate: Date | string | null;
  status: string;
  tickets: TicketWithVotes[];
  participants: ParticipantWithMember[];
  product: { id: string; members: Member[]; jiraBaseUrl?: string | null };
}

// ── Ticket Node Card ─────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ef4444",
  High:    "#f97316",
  Medium:  "#eab308",
  Low:     "#3b82f6",
  Lowest:  "#6b7280",
};

function TicketNode({
  ticket,
  assignee,
  jiraAssigneeName,
  jiraBaseUrl,
  priority,
  children,
}: {
  ticket: TicketWithVotes;
  assignee: Member | null;
  jiraAssigneeName?: string | null;
  jiraBaseUrl?: string | null;
  priority?: string | null;
  children?: React.ReactNode;
}) {
  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${ticket.jiraKey}` : null;
  const priorityColor = priority ? (PRIORITY_COLORS[priority] ?? "#6b7280") : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl w-full max-w-2xl">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <TicketTypeIcon type={ticket.issueType} size={14} />
          <span className="text-white/40 text-xs">{ticket.issueType ?? "Story"}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="font-mono text-violet-400 text-xs font-semibold tracking-wide">{ticket.jiraKey}</span>
          {priority && priorityColor && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5" style={{ color: priorityColor }}>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: priorityColor }} />
              {priority}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {assignee && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
              <MemberAvatar name={assignee.name} role={assignee.role} size={18} />
              <span className="text-[11px] text-white/60">{assignee.name.split(" ")[0]}</span>
              <RoleBadge role={assignee.role} size="sm" />
            </div>
          )}
          {!assignee && jiraAssigneeName && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-[11px] text-white/50">{jiraAssigneeName}</span>
            </div>
          )}
          {jiraUrl && (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Title + description */}
      <div className="px-6 py-5">
        <h2 className="text-xl font-bold text-white leading-snug tracking-tight mb-3">
          {ticket.title}
        </h2>
        {ticket.description && (
          <p className="text-sm text-white/50 leading-relaxed line-clamp-4">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Footer */}
      {children && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
}

// ── JIRA sync status badge ────────────────────────────────────────────────────

function JiraSyncBadge({ status }: { status: "idle" | "saving" | "synced" | "partial" | "failed" }) {
  if (status === "idle") return null;
  if (status === "saving") return (
    <span className="flex items-center gap-1 text-xs text-white/40">
      <span className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin" />
      Syncing to JIRA…
    </span>
  );
  if (status === "synced") return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> Synced to JIRA
    </span>
  );
  if (status === "partial") return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <AlertTriangle className="w-3.5 h-3.5" /> JIRA partial sync
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <AlertTriangle className="w-3.5 h-3.5" /> JIRA sync failed
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function HostView({ session, productId }: { session: PokerSession; productId: string }) {
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState<"WAITING" | "ACTIVE" | "COMPLETED">(
    session.status as "WAITING" | "ACTIVE" | "COMPLETED"
  );
  const [checkedIn, setCheckedIn] = useState<CheckedInMember[]>([]);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [votedMemberIds, setVotedMemberIds] = useState<string[]>([]);
  const [votedCount, setVotedCount] = useState(0);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[] | null>(null);
  const [revealMeta, setRevealMeta] = useState<{ median: number; isConsensus: boolean } | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());
  const [ticketAssignees, setTicketAssignees] = useState<Record<string, string>>({});
  const [selectedEstimate, setSelectedEstimate] = useState<number | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  // note state removed — host note (ticketNotes) is used as the JIRA comment note
  const [copied, setCopied] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState(session.tickets);
  const [jiraStatus, setJiraStatus] = useState<"idle" | "saving" | "synced" | "partial" | "failed">("idle");

  // Task 3: pending ticket (host clicked but not yet opened)
  const [pendingTicket, setPendingTicket] = useState<TicketWithVotes | null>(null);
  // Per-ticket notes: retained when switching tickets
  const [ticketNotes, setTicketNotes] = useState<Record<string, string>>({});
  const getNote = (id: string) => ticketNotes[id] ?? "";
  const setNote2 = (id: string, val: string) => setTicketNotes((p) => ({ ...p, [id]: val }));

  // Per-ticket dependencies (set of dep types per ticket)
  const [ticketDeps, setTicketDeps] = useState<Record<string, string[]>>({});
  const getDeps = (id: string): string[] => ticketDeps[id] ?? [];
  const toggleDep = (id: string, dep: string) =>
    setTicketDeps((p) => {
      const cur = p[id] ?? [];
      return { ...p, [id]: cur.includes(dep) ? cur.filter((d) => d !== dep) : [...cur, dep] };
    });

  // Task 6: collapsed sections
  const [estimatedCollapsed, setEstimatedCollapsed] = useState(true);

  // Session log
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);
  const addLogRef = useRef<(text: string) => void>(null!);
  addLogRef.current = (text: string) => setSessionLog((l) => [...l, { id: `${Date.now()}-${Math.random()}`, time: new Date(), text }]);
  const addLog = (text: string) => addLogRef.current(text);
  const [sessionTimer, setSessionTimer] = useState<string>("");

  // Item 3: summary modal
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryIssueKey, setSummaryIssueKey] = useState("");
  const [summaryState, setSummaryState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [recapOpen, setRecapOpen] = useState(session.status === "COMPLETED");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);

  // Auto-redirect to product page when recap is closed
  const closeRecap = () => {
    setRecapOpen(false);
    router.push(`/products/${productId}`);
  };

  const sessionStartedAt = useRef<Date | null>(null);
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  const checkedInRef = useRef(checkedIn);
  checkedInRef.current = checkedIn;
  const membersRef = useRef(session.product.members);
  membersRef.current = session.product.members;

  useEffect(() => {
    if (sessionStatus !== "ACTIVE") { setSessionTimer(""); return; }
    if (!sessionStartedAt.current) sessionStartedAt.current = new Date();
    const tick = () => {
      const elapsed = Date.now() - (sessionStartedAt.current?.getTime() ?? Date.now());
      const mins = Math.floor(elapsed / 60000);
      const hrs = Math.floor(mins / 60);
      setSessionTimer(hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [sessionStatus]);

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${session.shortCode ?? session.id}` : "";

  const applyState = useCallback((state: PublicState) => {
    setSessionStatus(state.sessionStatus);
    setCheckedIn(state.checkedIn);
    setCurrentTicketId(state.currentTicket?.ticketId ?? null);
    setVotedMemberIds(state.votedMemberIds);
    setVotedCount(state.votedMemberIds.length);
    setRevealedVotes(state.revealedVotes);
    setLockedTickets(new Set(state.lockedTickets));
    setTicketAssignees(state.lockedTicketAssignees ?? {});
    if (state.currentTicket?.contextNote) {
      setTicketNotes((p) => ({ ...p, [state.currentTicket!.ticketId]: state.currentTicket!.contextNote! }));
    }
    if (state.revealed && state.revealedVotes) {
      const vals = state.revealedVotes.map((v) => v.value);
      const sorted = [...vals].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      setRevealMeta({ median: med, isConsensus: new Set(vals).size === 1 });
    } else {
      setRevealMeta(null);
    }
  }, []);

  const { send } = usePartyRoom(session.id, useCallback((msg: MsgOut) => {
    switch (msg.type) {
      case "STATE_SYNC": applyState(msg.state); break;
      case "PRESENCE_UPDATE":
        setCheckedIn((prev) => {
          const prevIds = new Set(prev.map((c) => c.memberId));
          for (const c of msg.checkedIn) {
            if (!prevIds.has(c.memberId)) addLogRef.current(`${c.memberName} checked in`);
          }
          return msg.checkedIn;
        });
        break;
      case "SESSION_STARTED": setSessionStatus("ACTIVE"); sessionStartedAt.current = new Date(); addLogRef.current("Session started"); break;
      case "TICKET_OPENED":
        setCurrentTicketId(msg.ticketId);
        if (msg.contextNote) setTicketNotes((p) => ({ ...p, [msg.ticketId]: msg.contextNote! }));
        setVotedMemberIds([]); setVotedCount(0);
        setRevealedVotes(null); setRevealMeta(null);
        setSelectedEstimate(null); setSelectedAssigneeId(null);
        setJiraStatus("idle");
        addLogRef.current(`Opened ${msg.jiraKey}: ${msg.title.slice(0, 40)}${msg.title.length > 40 ? "…" : ""}`);
        break;
      case "VOTE_PROGRESS":
        setVotedMemberIds(msg.votedMemberIds); setVotedCount(msg.votedCount); break;
      case "VOTES_REVEALED":
        setRevealedVotes(msg.votes);
        setRevealMeta({ median: msg.median, isConsensus: msg.isConsensus });
        if (msg.isConsensus) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        addLogRef.current(`Votes revealed — median ${msg.median}${msg.isConsensus ? " (consensus)" : ""}`);
        break;
      case "ESTIMATE_LOCKED": {
        setLockedTickets((l) => new Set([...l, msg.ticketId]));
        if (msg.assigneeId) setTicketAssignees((a) => ({ ...a, [msg.ticketId]: msg.assigneeId! }));
        setTickets((t) => t.map((tk) => tk.id === msg.ticketId ? { ...tk, status: "ESTIMATED" as const, finalEstimate: msg.value } : tk));
        setCurrentTicketId(null); setRevealedVotes(null); setRevealMeta(null);
        const lockedTicketTitle = ticketsRef.current.find((t) => t.id === msg.ticketId)?.jiraKey ?? msg.ticketId;
        const assigneeName = msg.assigneeId ? membersRef.current.find((m) => m.id === msg.assigneeId)?.name?.split(" ")[0] : null;
        addLogRef.current(`Locked ${lockedTicketTitle} at ${msg.value}pts${assigneeName ? ` → ${assigneeName}` : ""}`);
        break;
      }
      case "REACTION_RECEIVED": setReactions((r) => [...r.slice(-20), msg]); break;
      case "MEMBER_KICKED": {
        const kickedName = checkedInRef.current.find((c) => c.memberId === msg.memberId)?.memberName;
        if (kickedName) addLogRef.current(`${kickedName} was kicked (can re-check-in)`);
        setCheckedIn((prev) => prev.filter((c) => c.memberId !== msg.memberId));
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyState]));

  const currentTicket = tickets.find((t) => t.id === currentTicketId) ?? null;

  const startSession = () => {
    send({ type: "START_SESSION" });
    fetch(`/api/sessions/${session.id}/start`, { method: "POST" }).catch(() => {});
  };

  const kickMember = (memberId: string) => {
    if (confirmKickId === memberId) {
      send({ type: "KICK_MEMBER", memberId });
      setConfirmKickId(null);
    } else {
      setConfirmKickId(memberId);
      setTimeout(() => setConfirmKickId((id) => id === memberId ? null : id), 4000);
    }
  };

  const noteUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushNoteToMembers = (ticketId: string, note: string) => {
    if (noteUpdateTimer.current) clearTimeout(noteUpdateTimer.current);
    noteUpdateTimer.current = setTimeout(() => {
      send({ type: "UPDATE_NOTE", ticketId, note });
    }, 800);
  };

  const openTicket = (t: TicketWithVotes) => {
    const note = getNote(t.id);
    setPendingTicket(null);
    send({ type: "OPEN_TICKET", ticketId: t.id, jiraKey: t.jiraKey, title: t.title, description: t.description ?? undefined, contextNote: note || undefined, issueType: t.issueType ?? undefined, priority: t.priority ?? undefined, deps: getDeps(t.id).length > 0 ? getDeps(t.id) : undefined });
  };

  const reveal = () => send({ type: "REVEAL_VOTES" });

  const lockEstimate = async () => {
    if (!currentTicket || selectedEstimate === null) return;
    setSavingLock(true);
    setJiraStatus("saving");
    const lockNote = getNote(currentTicket.id);
    send({ type: "LOCK_ESTIMATE", ticketId: currentTicket.id, value: selectedEstimate, note: lockNote || undefined, assigneeId: selectedAssigneeId ?? undefined });
    try {
      const res = await fetch(`/api/sessions/${session.id}/tickets/${currentTicket.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: selectedEstimate, note: lockNote, votes: revealedVotes ?? [], assigneeId: selectedAssigneeId }),
      });
      const data = await res.json();
      if (data.jiraSync) {
        const { points, comment, assignee } = data.jiraSync;
        const allOk = points && comment;
        const anyOk = points || comment || assignee;
        setJiraStatus(allOk ? "synced" : anyOk ? "partial" : "failed");
      } else {
        setJiraStatus("failed");
      }
    } catch {
      setJiraStatus("failed");
    }
    setSavingLock(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enrichedTickets = tickets.map((t) => ({ ...t, assigneeId: ticketAssignees[t.id] ?? t.assigneeId }));

  const NON_VOTING_ROLES = ["UI_UX", "SM", "TECH_LEAD"];
  const voterCount = checkedIn.filter((c) => !NON_VOTING_ROLES.includes(c.role)).length;

  const presentMembers = session.product.members
    .filter((m) => checkedIn.some((c) => c.memberId === m.id))
    .map((m) => ({
      memberId: m.id, memberName: m.name, role: m.role,
      capacity: (m as Member & { capacity?: number }).capacity ?? 20,
    }));

  const currentAssigneeId = currentTicket ? (ticketAssignees[currentTicket.id] ?? currentTicket.assigneeId) : null;
  const currentAssignee = currentAssigneeId ? session.product.members.find((m) => m.id === currentAssigneeId) ?? null : null;

  // Task 6: split tickets into sections
  const toEstimateTickets = tickets.filter((t) => !lockedTickets.has(t.id) && t.status !== "ESTIMATED");
  const estimatedTickets = tickets.filter((t) => lockedTickets.has(t.id) || t.status === "ESTIMATED");

  // For SprintCalendar
  const sprintStart = session.sprintStartDate ? new Date(session.sprintStartDate) : null;
  const sprintEnd = session.sprintEndDate ? new Date(session.sprintEndDate) : null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 bg-black/20 backdrop-blur-sm px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">{session.sprintName}</span>
            {session.name && (
              <><span className="text-white/20 text-sm">·</span><span className="text-white/60 text-xs">{session.name}</span></>
            )}
            {sprintStart && sprintEnd && (
              <span className="text-white/40 text-xs">
                {sprintStart.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – {sprintEnd.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
              </span>
            )}
            {sessionStatus === "ACTIVE" && sessionTimer && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-violet-400/60 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                <Clock className="w-3 h-3" />
                {sessionTimer}
              </span>
            )}
            <span className="text-white/20 text-sm">·</span>
            <span className="text-white/40 text-xs">Refinement</span>
          </div>
          <Badge variant={sessionStatus === "ACTIVE" ? "warning" : sessionStatus === "COMPLETED" ? "success" : "ghost"}>
            {sessionStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {(sessionStatus === "ACTIVE" || sessionStatus === "WAITING") && (
            confirmEnd ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/50">End session?</span>
                <Button variant="destructive" size="sm" onClick={async () => {
                  setConfirmEnd(false);
                  send({ type: "END_SESSION" });
                  await fetch(`/api/sessions/${session.id}/end`, { method: "POST" });
                  setSessionStatus("COMPLETED");
                  setRecapOpen(true);
                }}>Confirm</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>
                End Session
              </Button>
            )
          )}
          {estimatedTickets.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSummaryModalOpen(true)}>
              <FileText className="w-3.5 h-3.5" />
              Summary
            </Button>
          )}
          {lockedTickets.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setBulkDrawerOpen(true)}>
              <GitMerge className="w-3.5 h-3.5" />
              Bulk Assign
              <span className="ml-1 text-violet-400 font-mono text-xs">{lockedTickets.size}</span>
            </Button>
          )}
          <button
            onClick={copyLink}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Share link"}
          </button>
          <div className="flex items-center gap-1.5 text-sm text-white/30">
            <Users className="w-3.5 h-3.5" />
            <span className="text-xs tabular-nums">{checkedIn.length}/{session.product.members.length}</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Ticket sidebar ── */}
        <aside className="w-68 shrink-0 border-r border-white/8 bg-black/10 flex flex-col h-full">
          <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
            <p className="text-xs text-white/30 font-medium uppercase tracking-widest">
              Issues · {tickets.length}
            </p>
            {sessionStatus === "ACTIVE" && (
              <button
                onClick={async () => {
                  const res = await fetch(`/api/sessions/${session.id}/refresh-tickets`, { method: "POST" });
                  if (res.ok) {
                    const data = await res.json();
                    setTickets(data.tickets);
                    setLockedTickets(new Set(data.tickets.filter((t: { status: string }) => t.status === "ESTIMATED").map((t: { id: string }) => t.id)));
                  }
                }}
                title="Refresh tickets from JIRA (keeps estimated, clears pending)"
                className="text-white/25 hover:text-violet-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {/* Estimated section — shown first */}
            {estimatedTickets.length > 0 && (
              <div>
                <button
                  onClick={() => setEstimatedCollapsed((c) => !c)}
                  className="flex items-center gap-2 px-3 py-2 w-full text-[10px] text-white/30 font-semibold uppercase tracking-widest hover:text-white/50 transition-colors"
                >
                  {estimatedCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span className="flex-1 text-left">Estimated</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1 py-0.5 font-mono">{estimatedTickets.length}</span>
                </button>
                <AnimatePresence initial={false}>
                  {!estimatedCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {estimatedTickets.map((ticket) => {
                        const assigneeId = ticketAssignees[ticket.id] ?? ticket.assigneeId;
                        const assignee = assigneeId ? session.product.members.find((m) => m.id === assigneeId) : null;
                        return (
                          <div key={ticket.id} className="group w-full text-left px-3 py-2.5 border-l-2 border-l-transparent hover:bg-white/3 transition-colors">
                            <div className="flex items-start gap-2 relative">
                              <div className="mt-0.5 shrink-0">
                                <TicketTypeIcon type={ticket.issueType} size={12} />
                              </div>
                              <div className="flex-1 min-w-0 opacity-50">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-xs font-mono text-violet-400/80 shrink-0">{ticket.jiraKey}</span>
                                  {ticket.finalEstimate != null && (
                                    <span className="text-xs font-mono text-emerald-400/80 ml-auto">{ticket.finalEstimate}pt</span>
                                  )}
                                </div>
                                <p className="text-xs text-white/60 leading-snug line-clamp-2">{ticket.title}</p>
                                {assignee && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MemberAvatar name={assignee.name} role={assignee.role} size={14} />
                                    <span className="text-xs text-white/30">{assignee.name.split(" ")[0]}</span>
                                  </div>
                                )}
                              </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                                {/* Reassign — keep estimate, just change owner */}
                                <button
                                  onClick={() => setReassignTicketId(reassignTicketId === ticket.id ? null : ticket.id)}
                                  className="text-[10px] text-white/30 hover:text-violet-400 border border-white/10 hover:border-violet-400/40 rounded px-1.5 py-0.5"
                                  title="Reassign without re-voting"
                                >
                                  ⇄
                                </button>
                                {/* Repoker — full reset */}
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/sessions/${session.id}/tickets/${ticket.id}/repoker`, { method: "POST" });
                                    setLockedTickets((l) => { const n = new Set(l); n.delete(ticket.id); return n; });
                                    setTicketAssignees((a) => { const n = { ...a }; delete n[ticket.id]; return n; });
                                    setTickets((t) => t.map((tk) => tk.id === ticket.id ? { ...tk, status: "PENDING" as const, finalEstimate: null, assigneeId: null } : tk));
                                  }}
                                  className="text-[10px] text-white/30 hover:text-amber-400 border border-white/10 hover:border-amber-400/40 rounded px-1.5 py-0.5"
                                  title="Repoker — reset estimate and re-vote"
                                >
                                  ↺
                                </button>
                              </div>
                              {/* Inline reassign picker */}
                              {reassignTicketId === ticket.id && (
                                <div className="absolute right-0 top-full mt-1 z-10 bg-[#0d0b1a] border border-white/15 rounded-xl shadow-2xl p-2 w-40">
                                  <p className="text-[10px] text-white/30 px-2 pb-1 uppercase tracking-widest">Reassign to</p>
                                  {session.product.members.map((m) => (
                                    <button
                                      key={m.id}
                                      onClick={async () => {
                                        await fetch(`/api/sessions/${session.id}/bulk-assign`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ assignments: [{ ticketId: ticket.id, memberId: m.id }] }),
                                        });
                                        setTicketAssignees((a) => ({ ...a, [ticket.id]: m.id }));
                                        setTickets((t) => t.map((tk) => tk.id === ticket.id ? { ...tk, assigneeId: m.id } : tk));
                                        send({ type: "LOCK_ESTIMATE", ticketId: ticket.id, value: ticket.finalEstimate!, assigneeId: m.id });
                                        setReassignTicketId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors text-left"
                                    >
                                      <MemberAvatar name={m.name} role={m.role} size={18} />
                                      <span className="text-xs text-white/70">{m.name.split(" ")[0]}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* To estimate section */}
            <div>
              <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-white/30 font-semibold uppercase tracking-widest">
                <span className="flex-1">To estimate</span>
                <span className="text-[10px] bg-white/10 rounded px-1 py-0.5 font-mono">{toEstimateTickets.length}</span>
              </div>
              {toEstimateTickets.map((ticket) => {
                const isCurrent = currentTicketId === ticket.id;
                const isPending = pendingTicket?.id === ticket.id;
                const assigneeId = ticketAssignees[ticket.id] ?? ticket.assigneeId;
                const assignee = assigneeId ? session.product.members.find((m) => m.id === assigneeId) : null;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      if (sessionStatus !== "ACTIVE") return;
                      if (isCurrent) return;
                      if (currentTicketId) {
                        openTicket(ticket);
                      } else {
                        setPendingTicket(ticket);
                      }
                    }}
                    disabled={sessionStatus !== "ACTIVE"}
                    className={`w-full text-left px-3 py-2.5 transition-all border-l-2 ${
                      isCurrent
                        ? "bg-violet-600/15 border-l-violet-500"
                        : isPending
                        ? "bg-amber-600/10 border-l-amber-400"
                        : "hover:bg-white/4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        <TicketTypeIcon type={ticket.issueType} size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-mono text-violet-400/80 shrink-0">{ticket.jiraKey}</span>
                        </div>
                        <p className="text-xs text-white/60 leading-snug line-clamp-2">{ticket.title}</p>
                        {assignee && (
                          <div className="flex items-center gap-1 mt-1">
                            <MemberAvatar name={assignee.name} role={assignee.role} size={12} />
                            <span className="text-xs text-white/30">{assignee.name.split(" ")[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </aside>

        {/* ── Main canvas ── */}
        <main className="flex-1 flex flex-col overflow-y-auto">

          {/* Sprint Calendar — centered, always visible */}
          <div className="shrink-0 border-b border-white/8 px-6 py-4">
            <div className="max-w-5xl mx-auto">
              <SprintCalendar
                sessionId={session.id}
                startDate={sprintStart}
                endDate={sprintEnd}
                members={session.product.members}
                checkedIn={checkedIn}
              />
            </div>
          </div>

          {/* WAITING */}
          {sessionStatus === "WAITING" && (
            <div className="flex flex-col items-center gap-8 p-12 flex-1">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Waiting for team</h2>
                <p className="text-white/40 text-sm">Share the join link — members select their name to check in.</p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full max-w-sm">
                <span className="text-white/50 text-xs truncate flex-1 font-mono">{joinUrl}</span>
                <button onClick={copyLink} className="text-violet-400 hover:text-violet-300 shrink-0">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-3 justify-center max-w-sm">
                {session.product.members.map((m) => {
                  const isIn = checkedIn.some((c) => c.memberId === m.id);
                  return (
                    <motion.div key={m.id} animate={isIn ? { scale: [1, 1.1, 1] } : {}} className="flex flex-col items-center gap-1">
                      <MemberAvatar name={m.name} role={m.role} size={40} showRing={isIn} dimmed={!isIn} />
                      <span className="text-[10px] text-white/30">{m.name.split(" ")[0]}</span>
                    </motion.div>
                  );
                })}
              </div>
              <Button onClick={startSession} size="lg" disabled={checkedIn.length === 0}>
                <Play className="w-4 h-4" />
                Start session ({checkedIn.length} checked in)
              </Button>

            </div>
          )}

          {/* ACTIVE — pending ticket (not yet broadcast) */}
          {sessionStatus === "ACTIVE" && pendingTicket && !currentTicketId && (
            <div className="flex flex-col items-center gap-6 px-8 py-8 flex-1">
              <div className="w-full max-w-2xl space-y-4">
                <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Ready to open</p>
                <TicketNode
                  ticket={pendingTicket}
                  assignee={(() => {
                    const aid = ticketAssignees[pendingTicket.id] ?? pendingTicket.assigneeId;
                    return aid ? session.product.members.find((m) => m.id === aid) ?? null : null;
                  })()}
                  jiraAssigneeName={pendingTicket.jiraAssigneeName}
                  jiraBaseUrl={session.product.jiraBaseUrl}
                  priority={pendingTicket.priority}
                />
                <div className="space-y-1">
                  <p className="text-xs text-amber-400/80 font-semibold uppercase tracking-widest">Host note — members see this while voting</p>
                  <textarea
                    value={getNote(pendingTicket.id)}
                    onChange={(e) => setNote2(pendingTicket.id, e.target.value)}
                    placeholder="Optional context note — shown to participants alongside the ticket"
                    rows={2}
                    className="w-full rounded-lg border border-amber-500/30 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-amber-400 focus:outline-none resize-none"
                  />
                  <p className="text-xs text-white/30 mt-1">Tip: Type your note here before starting voting.</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Dependencies</p>
                  <div className="flex flex-wrap gap-2">
                    {["SAP", "Network Team", "UI/UX", "Security", "Data"].map((dep) => {
                      const active = getDeps(pendingTicket.id).includes(dep);
                      return (
                        <button key={dep} type="button" onClick={() => toggleDep(pendingTicket.id, dep)}
                          className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${active ? "border-amber-500/60 bg-amber-500/15 text-amber-300" : "border-white/15 bg-white/3 text-white/40 hover:border-white/30 hover:text-white/60"}`}>
                          {dep}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => openTicket(pendingTicket)} variant="success">
                    <Play className="w-4 h-4" />
                    Start voting on this ticket
                  </Button>
                  <Button variant="ghost" onClick={() => setPendingTicket(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE — no ticket and no pending */}
          {sessionStatus === "ACTIVE" && !currentTicket && !pendingTicket && (
            <div className="flex items-center justify-center flex-1 text-white/20 text-sm">
              Select a ticket from the sidebar to start voting
            </div>
          )}

          {/* ACTIVE — ticket open */}
          {sessionStatus === "ACTIVE" && currentTicket && (
            <div className="flex flex-col items-center gap-6 px-8 py-8 flex-1">

              {/* Ticket node — centered card */}
              <TicketNode
                ticket={currentTicket}
                assignee={currentAssignee}
                jiraAssigneeName={currentTicket.jiraAssigneeName}
                jiraBaseUrl={session.product.jiraBaseUrl}
                priority={currentTicket.priority}
              />

              {/* Context note — always editable (note was sent to members on ticket open) */}
              <div className="w-full max-w-2xl space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Host note</p>
                  <span className="text-[10px] text-white/20 ml-2">Auto-synced when you type · Sent on ticket open</span>
                </div>
                <textarea
                  value={getNote(currentTicket.id)}
                  onChange={(e) => {
                    setNote2(currentTicket.id, e.target.value);
                    pushNoteToMembers(currentTicket.id, e.target.value);
                  }}
                  placeholder="Host note — auto-synced to members"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-white/15 focus:border-violet-500/50 focus:outline-none resize-none"
                />
              </div>

              {/* Dependencies */}
              <div className="w-full max-w-2xl space-y-2">
                <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Dependencies</p>
                <div className="flex flex-wrap gap-2">
                  {["SAP", "Network Team", "UI/UX", "Security", "Data"].map((dep) => {
                    const active = getDeps(currentTicket.id).includes(dep);
                    return (
                      <button key={dep} type="button" onClick={() => toggleDep(currentTicket.id, dep)}
                        className={`px-3 py-1 rounded-full border text-xs font-medium transition-all ${active ? "border-amber-500/60 bg-amber-500/15 text-amber-300" : "border-white/10 bg-white/3 text-white/30 hover:border-white/25 hover:text-white/50"}`}>
                        {dep}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vote progress */}
              <div className="w-full max-w-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-500 rounded-full"
                      animate={{ width: voterCount > 0 ? `${(votedCount / voterCount) * 100}%` : "0%" }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                  <span className="text-xs text-white/30 shrink-0 tabular-nums font-mono">
                    {votedCount}/{voterCount}
                  </span>
                  <Badge variant={revealedVotes ? "success" : "warning"} >
                    {revealedVotes ? "Revealed" : "Voting"}
                  </Badge>
                </div>

                {/* Member vote indicators */}
                <div className="flex flex-wrap gap-3">
                  {checkedIn.map((m) => {
                    const hasVoted = votedMemberIds.includes(m.memberId);
                    return (
                      <div key={m.memberId} className="flex flex-col items-center gap-1">
                        <MemberAvatar name={m.memberName} role={m.role} size={38} showRing={hasVoted} dimmed={!hasVoted} />
                        <span className="text-[9px] text-white/25 max-w-[40px] truncate text-center">
                          {m.memberName.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Reveal button */}
                {!revealedVotes && (
                  <Button onClick={reveal} variant="success" disabled={votedCount === 0} className="self-start">
                    <Eye className="w-4 h-4" />
                    Reveal votes
                    {votedCount > 0 && <span className="opacity-50 font-mono text-xs ml-1">({votedCount})</span>}
                  </Button>
                )}
              </div>

              {/* Post-reveal */}
              {revealedVotes && revealMeta && (
                <div className="w-full max-w-2xl space-y-5">
                  {/* Flip cards */}
                  <div className="flex flex-wrap gap-3">
                    {revealedVotes.map((vote, i) => {
                      const member = checkedIn.find((c) => c.memberId === vote.memberId);
                      return (
                        <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value}
                          median={revealMeta.median} delay={i * 0.08} role={member?.role} />
                      );
                    })}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/30">
                      Median <span className="text-white font-bold font-mono">{revealMeta.median}</span>
                    </span>
                    {revealMeta.isConsensus && (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
                        <Sparkles className="w-4 h-4" /> Full consensus
                      </span>
                    )}
                  </div>

                  {/* Floating reactions from members — read-only for host */}
                  <EmojiReaction reactions={reactions} onReact={() => {}} readOnly />

                  {/* Lock estimate */}
                  {!lockedTickets.has(currentTicket.id) ? (
                    <div className="border-t border-white/8 pt-5 space-y-4">
                      <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Lock estimate</p>
                      <div className="flex gap-2 flex-wrap">
                        {FIBONACCI_VALUES.map((v) => (
                          <button
                            key={v}
                            onClick={() => setSelectedEstimate(v)}
                            className={`w-11 h-16 rounded-xl border-2 font-bold text-lg transition-all ${
                              selectedEstimate === v
                                ? "border-violet-400 bg-violet-600/40 text-white scale-110"
                                : "border-white/15 text-white/40 hover:border-violet-400/60 hover:text-white hover:scale-105"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <AssignmentPicker members={checkedIn} selectedMemberId={selectedAssigneeId} onChange={setSelectedAssigneeId} />
                      <div className="flex items-center gap-3">
                        <Button onClick={lockEstimate} disabled={selectedEstimate === null || savingLock} variant="success">
                          <Lock className="w-4 h-4" />
                          {savingLock ? "Saving..." : `Lock${selectedEstimate ? ` — ${selectedEstimate} pts` : ""}`}
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <JiraSyncBadge status={jiraStatus} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-2">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">Locked</span>
                      </div>
                      <JiraSyncBadge status={jiraStatus} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Bandwidth rail ── */}
        {sessionStatus !== "WAITING" && (
          <BandwidthRail
            members={presentMembers}
            estimatedTickets={enrichedTickets}
            pendingAssigneeId={selectedAssigneeId}
            pendingEstimate={selectedEstimate}
            productId={productId}
            onKick={kickMember}
            sessionLog={sessionLog}
          />
        )}
      </div>

      {/* Bulk assign drawer */}
      <BulkAssignDrawer
        open={bulkDrawerOpen}
        onClose={() => setBulkDrawerOpen(false)}
        sessionId={session.id}
        tickets={enrichedTickets as (TicketWithVotes & { assigneeId: string | null })[]}
        members={session.product.members as (Member & { capacity: number })[]}
        estimatedTickets={enrichedTickets}
        onCommit={(assignments) => {
          const map = Object.fromEntries(assignments.map((a) => [a.ticketId, a.memberId]));
          setTickets((prev) => prev.map((t) => (map[t.id] ? { ...t, assigneeId: map[t.id] } : t)));
          setTicketAssignees((prev) => ({ ...prev, ...map }));
        }}
      />

      {/* Session Recap overlay */}
      <AnimatePresence>
        {recapOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-[#0d0b1a] border border-white/15 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-white/10 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-5 h-5 text-violet-400" />
                    <h2 className="text-xl font-bold text-white">Session Complete</h2>
                  </div>
                  <p className="text-white/40 text-sm">{session.sprintName}</p>
                </div>
                <div className="text-right text-xs text-white/30">
                  {sprintStart && sprintEnd && (
                    <p>{sprintStart.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – {sprintEnd.toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</p>
                  )}
                  {sessionStartedAt.current && (
                    <p className="flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-3 h-3" />
                      Duration: {Math.round((Date.now() - sessionStartedAt.current.getTime()) / 60000)} min
                    </p>
                  )}
                </div>
              </div>

              <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Attendance */}
                <div>
                  <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-3">Team · {checkedIn.length} attended</p>
                  <div className="flex flex-wrap gap-3">
                    {checkedIn.map((m) => {
                      const member = session.product.members.find((x) => x.id === m.memberId);
                      return (
                        <div key={m.memberId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                          <MemberAvatar name={m.memberName} role={m.role} size={22} />
                          <span className="text-xs text-white/70">{m.memberName}</span>
                          {member && <RoleBadge role={member.role} size="sm" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Estimated tickets */}
                <div>
                  <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-3">
                    Estimated · {estimatedTickets.length} tickets · {estimatedTickets.reduce((s, t) => s + (t.finalEstimate ?? 0), 0)} pts total
                  </p>
                  <div className="space-y-1.5">
                    {estimatedTickets.map((t) => {
                      const aid = ticketAssignees[t.id] ?? t.assigneeId;
                      const assignee = aid ? session.product.members.find((m) => m.id === aid) : null;
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/8">
                          <TicketTypeIcon type={t.issueType} size={12} />
                          <span className="font-mono text-[10px] text-violet-400/70 shrink-0">{t.jiraKey}</span>
                          <span className="text-xs text-white/60 flex-1 truncate">{t.title}</span>
                          {assignee && <MemberAvatar name={assignee.name} role={assignee.role} size={18} />}
                          <span className="font-mono text-xs text-emerald-400 shrink-0">{t.finalEstimate ?? "—"} pts</span>
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
                <Button variant="ghost" size="sm" onClick={() => setSummaryModalOpen(true)}>
                  <FileText className="w-3.5 h-3.5" />
                  Post to JIRA
                </Button>
                <Button variant="ghost" onClick={closeRecap}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary modal */}
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
                    const data = await res.json();
                    setSummaryState(data.success ? "success" : "error");
                  } catch {
                    setSummaryState("error");
                  }
                }}
              >
                {summaryState === "loading" ? "Posting…" : "Post to JIRA"}
              </Button>
              <Button variant="ghost" onClick={() => { setSummaryModalOpen(false); setSummaryState("idle"); setSummaryIssueKey(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
