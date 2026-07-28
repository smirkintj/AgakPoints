"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import { useLatestRef } from "@/hooks/useLatestRef";
import { ConnectionStatusBanner } from "@/components/session/ConnectionStatusBanner";
import type { MsgOut, CheckedInMember, RevealedVote, PublicState } from "@/types/partykit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealCard } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { AssignmentPicker } from "@/components/session/AssignmentPicker";
import { BandwidthRail, type SessionLogEntry } from "@/components/session/BandwidthRail";
import { TicketTypeIcon } from "@/components/session/TicketTypeIcon";
import { SprintCalendar } from "@/components/session/SprintCalendar";
import type { Ticket, Member, SessionParticipant, Vote } from "@/types/models";
import { FIBONACCI_VALUES } from "@/lib/utils";
import {
  Award, Check, ChevronDown, ChevronRight, Clock, Copy, Eye, ExternalLink,
  Layers, Lock, Play, RefreshCw, Sparkles, Users,
} from "lucide-react";
import type confettiType from "canvas-confetti";
import { getAutoReaction } from "@/lib/gameReactions";
import { TargetIcon, SpicyIcon, ThinkIcon } from "@/components/ui/GameIcon";
import { AchievementBadge, BADGE_CONFIG } from "@/components/session/AchievementBadge";
import { CountdownRing } from "@/components/session/CountdownRing";
import type { Achievement, AchievementType } from "@prisma/client";

const ICON_MAP: Record<string, React.ReactNode> = {
  TARGET: <TargetIcon size={18} />,
  SPICY: <SpicyIcon size={18} />,
  THINK: <ThinkIcon size={18} />,
};

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
  product: { id: string; members: Member[]; jiraBaseUrl?: string | null; tagPresets?: string[]; dependencyTypes?: string[] };
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

// ── Main Component ────────────────────────────────────────────────────────────

async function fireConsensusBurst() {
  const confetti = (await import("canvas-confetti")).default as typeof confettiType;
  const colors = ["#7c3aed", "#a78bfa", "#10b981", "#ffffff", "#4f46e5"];
  confetti({ particleCount: 80, spread: 55, origin: { x: 0.5, y: 0.55 }, colors, scalar: 1.1, gravity: 0.9 });
  setTimeout(() => {
    confetti({ particleCount: 50, spread: 80, origin: { x: 0.5, y: 0.5 }, colors, scalar: 0.9, gravity: 1.1, ticks: 180 });
  }, 150);
}

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
  const revealedVotesRef = useRef<RevealedVote[] | null>(null);
  const [memberVoteHistory, setMemberVoteHistory] = useState<Record<string, { vote: number; final: number }[]>>({});
  const [revealMeta, setRevealMeta] = useState<{ median: number; isConsensus: boolean } | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());
  const [ticketAssignees, setTicketAssignees] = useState<Record<string, string>>({});
  const [selectedEstimate, setSelectedEstimate] = useState<number | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  // note state removed — host note (ticketNotes) is used as the JIRA comment note
  const [copied, setCopied] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [reassignTicketId, setReassignTicketId] = useState<string | null>(null);
  const [tickets, setTickets] = useState(session.tickets);
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
  // Stable identity — setSessionLog never changes, so socket handlers can close
  // over this without going stale.
  const addLog = useCallback((text: string) => {
    setSessionLog((l) => [...l, { id: `${Date.now()}-${Math.random()}`, time: new Date(), text }]);
  }, []);
  const [sessionTimer, setSessionTimer] = useState<string>("");

  const [autoReaction, setAutoReaction] = useState<{ iconKey: string; label: string } | null>(null);
  const [sessionAchievements, setSessionAchievements] = useState<Achievement[]>([]);
  const [showAwardsCeremony, setShowAwardsCeremony] = useState(false);
  const [oracleToasts, setOracleToasts] = useState<{ id: number; memberId: string; memberName: string; value: number; isMe: boolean }[]>([]);

  // Timer state
  const [timerDuration, setTimerDuration] = useState<number | null>(20);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerExpired, setTimerExpired] = useState(false);
  // Ticket flags (TL feature)
  const [ticketFlags, setTicketFlags] = useState<Record<string, string[]>>({});
  // Role notes per ticket
  const [ticketRoleNotes, setTicketRoleNotes] = useState<Record<string, { general: string; DEV: string; QA: string; UI_UX: string }>>({});
  const [noteTab, setNoteTab] = useState<"general" | "DEV" | "QA" | "UI_UX">("general");
  const getRoleNote = (ticketId: string, role: "general" | "DEV" | "QA" | "UI_UX") =>
    ticketRoleNotes[ticketId]?.[role] ?? "";
  const setRoleNote = (ticketId: string, role: "general" | "DEV" | "QA" | "UI_UX", val: string) =>
    setTicketRoleNotes((p) => ({ ...p, [ticketId]: { ...(p[ticketId] ?? { general: "", DEV: "", QA: "", UI_UX: "" }), [role]: val } }));

  const [recapOpen, setRecapOpen] = useState(session.status === "COMPLETED");
  // Frozen at the moment the session ends. Deriving it in render instead would
  // mean calling Date.now() mid-render and make the figure creep upward on every
  // unrelated re-render of an already-finished session.
  const [recapDurationMin, setRecapDurationMin] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [switchConfirmTicket, setSwitchConfirmTicket] = useState<TicketWithVotes | null>(null);

  // Auto-redirect to product page when recap is closed
  const closeRecap = () => {
    router.push(`/products/${productId}`);
  };

  const sessionStartedAt = useRef<Date | null>(null);
  const ticketsRef = useLatestRef(tickets);
  const checkedInRef = useLatestRef(checkedIn);
  const membersRef = useLatestRef(session.product.members);
  useEffect(() => {
    revealedVotesRef.current = revealedVotes;
  });

  useEffect(() => {
    if (sessionStatus !== "ACTIVE") {
      // Deferred rather than set synchronously: clearing during the effect pass
      // re-renders before the browser paints, which React flags as a cascade.
      const clearId = setTimeout(() => setSessionTimer(""), 0);
      return () => clearTimeout(clearId);
    }
    if (!sessionStartedAt.current) sessionStartedAt.current = new Date();
    const tick = () => {
      const elapsed = Date.now() - (sessionStartedAt.current?.getTime() ?? Date.now());
      const totalSecs = Math.floor(elapsed / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      setSessionTimer(h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
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
    setTimerDuration(state.timerDuration ?? 20);
    setTimerStartedAt(state.timerStartedAt ?? null);
    setTicketFlags(state.ticketFlags ?? {});
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

  const adminTokenRef = useRef<string | null>(null);
  // sendRef allows the onOpen callback (defined before send) to call send
  const sendRef = useRef<(msg: import("@/types/partykit").MsgIn) => void>(() => {});

  // Fetch admin token once on mount. We also re-send REGISTER_ADMIN from the
  // onOpen callback (already wired below), so whichever arrives first wins.
  useEffect(() => {
    fetch(`/api/sessions/${session.id}/admin-token`)
      .then((r) => r.json())
      .then((data: { token?: string }) => {
        if (!data.token) return;
        adminTokenRef.current = data.token;
        // Send immediately — PartySocket buffers if not yet open.
        sendRef.current({ type: "REGISTER_ADMIN", token: data.token });
        // Retry every 500 ms for 5 s to cover slow handshakes and edge cold starts.
        let attempt = 0;
        const retryInterval = setInterval(() => {
          attempt++;
          if (!adminTokenRef.current || attempt >= 10) { clearInterval(retryInterval); return; }
          sendRef.current({ type: "REGISTER_ADMIN", token: adminTokenRef.current });
        }, 500);
      })
      .catch(() => {});
  }, [session.id]);

  const { send, status: connectionStatus } = usePartyRoom(session.id, useCallback((msg: MsgOut) => {
    switch (msg.type) {
      case "STATE_SYNC": applyState(msg.state); break;
      case "PRESENCE_UPDATE":
        setCheckedIn((prev) => {
          const prevIds = new Set(prev.map((c) => c.memberId));
          for (const c of msg.checkedIn) {
            if (!prevIds.has(c.memberId)) addLog(`${c.memberName} checked in`);
          }
          return msg.checkedIn;
        });
        break;
      case "SESSION_STARTED": setSessionStatus("ACTIVE"); sessionStartedAt.current = new Date(); addLog("Session started"); break;
      case "TICKET_OPENED":
        setCurrentTicketId(msg.ticketId);
        if (msg.contextNote) setTicketNotes((p) => ({ ...p, [msg.ticketId]: msg.contextNote! }));
        if (msg.noteForDev || msg.noteForQA || msg.noteForUIUX) {
          setTicketRoleNotes((p) => ({
            ...p,
            [msg.ticketId]: {
              general: msg.contextNote ?? p[msg.ticketId]?.general ?? "",
              DEV: msg.noteForDev ?? p[msg.ticketId]?.DEV ?? "",
              QA: msg.noteForQA ?? p[msg.ticketId]?.QA ?? "",
              UI_UX: msg.noteForUIUX ?? p[msg.ticketId]?.UI_UX ?? "",
            }
          }));
        }
        setVotedMemberIds([]); setVotedCount(0);
        setRevealedVotes(null); setRevealMeta(null);
        setSelectedEstimate(null); setSelectedAssigneeId(null);
        setTimerExpired(false);
        if (msg.timerStartedAt) setTimerStartedAt(msg.timerStartedAt);
        if (msg.timerDuration !== undefined) setTimerDuration(msg.timerDuration ?? null);
        addLog(`Opened ${msg.jiraKey}: ${msg.title.slice(0, 40)}${msg.title.length > 40 ? "…" : ""}`);
        break;
      case "VOTE_PROGRESS":
        setVotedMemberIds(msg.votedMemberIds); setVotedCount(msg.votedCount); break;
      case "VOTES_REVEALED":
        setRevealedVotes(msg.votes);
        setRevealMeta({ median: msg.median, isConsensus: msg.isConsensus });
        if (msg.isConsensus) fireConsensusBurst();
        {
          const ar = getAutoReaction(msg.votes.map((v) => v.value));
          setAutoReaction(ar);
          if (ar) setTimeout(() => setAutoReaction(null), 4000);
        }
        addLog(`Votes revealed — median ${msg.median}${msg.isConsensus ? " (consensus)" : ""}`);
        break;
      case "ESTIMATE_LOCKED": {
        setLockedTickets((l) => new Set([...l, msg.ticketId]));
        if (msg.assigneeId) setTicketAssignees((a) => ({ ...a, [msg.ticketId]: msg.assigneeId! }));
        setTickets((t) => t.map((tk) => tk.id === msg.ticketId ? { ...tk, status: "ESTIMATED" as const, finalEstimate: msg.value } : tk));
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
        {
          const exactMatches = (revealedVotesRef.current ?? []).filter((v) => v.value === msg.value);
          if (exactMatches.length > 0) {
            const newToasts = exactMatches.map((v, idx) => ({
              id: Date.now() + idx,
              memberId: v.memberId,
              memberName: v.memberName,
              value: v.value,
              isMe: false,
            }));
            setOracleToasts((prev) => [...prev, ...newToasts]);
            newToasts.forEach((t) => {
              setTimeout(() => setOracleToasts((prev) => prev.filter((x) => x.id !== t.id)), 3000);
            });
          }
        }
        setCurrentTicketId(null); setRevealedVotes(null); setRevealMeta(null);
        const lockedTicketTitle = ticketsRef.current.find((t) => t.id === msg.ticketId)?.jiraKey ?? msg.ticketId;
        const assigneeName = msg.assigneeId ? membersRef.current.find((m) => m.id === msg.assigneeId)?.name?.split(" ")[0] : null;
        addLog(`Locked ${lockedTicketTitle} at ${msg.value}pts${assigneeName ? ` → ${assigneeName}` : ""}`);
        break;
      }
      case "TICKET_DESIGN_UPDATED":
        setTickets(prev => prev.map(t => t.id === msg.ticketId ? {
          ...t,
          ...(msg.designReadiness !== undefined && { designReadiness: msg.designReadiness as "READY" | "IN_PROGRESS" | "NOT_STARTED" | null }),
          ...(msg.designComplexity !== undefined && { designComplexity: msg.designComplexity as "LOW" | "MEDIUM" | "HIGH" | null }),
          ...(msg.designLink !== undefined && { designLink: msg.designLink }),
        } : t));
        break;
      case "TICKET_TAGS_UPDATED":
        setTickets(prev => prev.map(t => t.id === msg.ticketId ? { ...t, tags: msg.tags } : t));
        break;
      case "TIMER_UPDATED":
        setTimerDuration(msg.duration);
        setTimerStartedAt(msg.startedAt);
        break;
      case "TICKET_FLAGS_UPDATED":
        setTicketFlags((p) => ({ ...p, [msg.ticketId]: msg.flags }));
        break;
      case "REACTION_RECEIVED": setReactions((r) => [...r.slice(-20), msg]); break;
      case "MEMBER_KICKED": {
        const kickedName = checkedInRef.current.find((c) => c.memberId === msg.memberId)?.memberName;
        if (kickedName) addLog(`${kickedName} was kicked (can re-check-in)`);
        setCheckedIn((prev) => prev.filter((c) => c.memberId !== msg.memberId));
        break;
      }
    }
  }, [applyState, addLog, checkedInRef, membersRef, ticketsRef]), useCallback(() => {
    if (adminTokenRef.current) {
      sendRef.current({ type: "REGISTER_ADMIN", token: adminTokenRef.current });
    }
  }, []), useCallback(() => adminTokenRef.current, []));

  // Keep sendRef in sync so the onOpen callback can call send
  useEffect(() => {
    sendRef.current = send;
  });

  const currentTicket = tickets.find((t) => t.id === currentTicketId) ?? null;

  const startSession = async () => {
    // Persist to DB first — this is the source of truth.
    const res = await fetch(`/api/sessions/${session.id}/start`, { method: "POST" }).catch((err) => {
      console.error("[startSession] network error:", err);
      return null;
    });
    if (!res) { addLog("Failed to start: network error"); return; }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("[startSession] API error:", res.status, body);
      addLog(`Failed to start: ${body.error ?? res.status}`);
      return;
    }
    // Broadcast to participants via PartyKit.
    send({ type: "START_SESSION" });
    // Update host's own UI directly — don't wait for the SESSION_STARTED
    // echo, which requires admin registration to be in place.
    setSessionStatus("ACTIVE");
    sessionStartedAt.current = new Date();
    addLog("Session started");
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
    const rNotes = ticketRoleNotes[t.id];
    // Update host UI immediately — don't wait for TICKET_OPENED echo which
    // requires admin registration to have completed first.
    setPendingTicket(null);
    setCurrentTicketId(t.id);
    setVotedMemberIds([]);
    setVotedCount(0);
    setRevealedVotes(null);
    setRevealMeta(null);
    setSelectedEstimate(null);
    setSelectedAssigneeId(null);
    setTimerExpired(false);
    setTimerStartedAt(null); // server will send authoritative startedAt via TICKET_OPENED
    send({
      type: "OPEN_TICKET",
      ticketId: t.id,
      jiraKey: t.jiraKey,
      title: t.title,
      description: t.description ?? undefined,
      contextNote: note || undefined,
      noteForDev: rNotes?.DEV || undefined,
      noteForQA: rNotes?.QA || undefined,
      noteForUIUX: rNotes?.UI_UX || undefined,
      issueType: t.issueType ?? undefined,
      priority: t.priority ?? undefined,
      deps: getDeps(t.id).length > 0 ? getDeps(t.id) : undefined,
    });
  };

  const reveal = () => send({ type: "REVEAL_VOTES" });

  const lockEstimate = async () => {
    if (!currentTicket || selectedEstimate === null) return;
    setSavingLock(true);
    const lockNote = getNote(currentTicket.id);
    const rNotes = ticketRoleNotes[currentTicket.id];
    try {
      const res = await fetch(`/api/sessions/${session.id}/tickets/${currentTicket.id}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: selectedEstimate,
          note: lockNote,
          votes: revealedVotes ?? [],
          assigneeId: selectedAssigneeId,
          noteForDev: rNotes?.DEV || null,
          noteForQA: rNotes?.QA || null,
          noteForUIUX: rNotes?.UI_UX || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      send({ type: "LOCK_ESTIMATE", ticketId: currentTicket.id, value: selectedEstimate, note: lockNote || undefined, assigneeId: selectedAssigneeId ?? undefined });
    } catch (err) {
      console.error("Lock estimate failed:", err);
      alert("Failed to save estimate. Please try again.");
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
    <div className="h-screen flex flex-col" style={{ background: "#060810" }}>
      <ConnectionStatusBanner status={connectionStatus} />
      {/* Aurora background layers */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "55%", height: "60%", background: "radial-gradient(ellipse, rgba(109,40,217,0.18) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "-15%", right: "-8%", width: "50%", height: "55%", background: "radial-gradient(ellipse, rgba(67,56,202,0.15) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "5%", width: "35%", height: "40%", background: "radial-gradient(ellipse, rgba(13,148,136,0.08) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", opacity: 0.025 }} />
      </div>
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
                <Button variant="danger" size="sm" onClick={async () => {
                  setConfirmEnd(false);
                  send({ type: "END_SESSION" });
                  const res = await fetch(`/api/sessions/${session.id}/end`, { method: "POST" });
                  if (res.ok) {
                    const data = await res.json();
                    if (data.achievements?.length > 0) {
                      setSessionAchievements(data.achievements);
                      setShowAwardsCeremony(true);
                    }
                  }
                  setSessionStatus("COMPLETED");
                  const startedAt = sessionStartedAt.current;
                  if (startedAt) {
                    setRecapDurationMin(Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000)));
                  }
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
          {/* Timer picker */}
          {sessionStatus === "ACTIVE" && (
            <select
              value={timerDuration === null ? "0" : String(timerDuration)}
              onChange={(e) => {
                const val = e.target.value === "0" ? null : Number(e.target.value);
                setTimerDuration(val);
                send({ type: "SET_TIMER", duration: val });
              }}
              className="text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg px-2 py-1.5 focus:outline-none hover:border-white/25 cursor-pointer"
              title="Voting timer"
            >
              <option value="0">Timer off</option>
              <option value="10">10s</option>
              <option value="20">20s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
            </select>
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
                                    const res = await fetch(`/api/sessions/${session.id}/tickets/${ticket.id}/repoker`, { method: "POST" });
                                    if (!res.ok) { console.error("Repoker failed", res.status); return; }
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
                                <div className="absolute right-0 top-full mt-1 z-20 bg-[#0d0b1a] border border-white/15 rounded-xl shadow-2xl p-2 min-w-[180px] max-w-[260px] max-h-60 overflow-y-auto">
                                  <p className="text-[10px] text-white/30 px-2 pb-1 uppercase tracking-widest">Reassign to</p>
                                  {session.product.members.map((m) => (
                                    <button
                                      key={m.id}
                                      onClick={async () => {
                                        const res = await fetch(`/api/sessions/${session.id}/bulk-assign`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ assignments: [{ ticketId: ticket.id, memberId: m.id }] }),
                                        });
                                        if (!res.ok) { console.error("Reassign failed", res.status); return; }
                                        setTicketAssignees((a) => ({ ...a, [ticket.id]: m.id }));
                                        setTickets((t) => t.map((tk) => tk.id === ticket.id ? { ...tk, assigneeId: m.id } : tk));
                                        send({ type: "LOCK_ESTIMATE", ticketId: ticket.id, value: ticket.finalEstimate!, assigneeId: m.id });
                                        setReassignTicketId(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/8 transition-colors text-left"
                                    >
                                      <MemberAvatar name={m.name} role={m.role} size={18} />
                                      <span className="text-xs text-white/70 truncate">{m.name}</span>
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
                        // Voting in progress (not yet revealed and not locked) — ask before discarding votes
                        const votingInProgress = votedMemberIds.length > 0 && !revealedVotes && !lockedTickets.has(currentTicketId);
                        if (votingInProgress) {
                          setSwitchConfirmTicket(ticket);
                        } else {
                          openTicket(ticket);
                        }
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
                          {ticket.designReadiness === "READY" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Design Ready" />}
                          {ticket.designReadiness === "IN_PROGRESS" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Design In Progress" />}
                          {ticket.designReadiness === "NOT_STARTED" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" title="Design Not Started" />}
                          {ticket.tags && ticket.tags.length > 0 && (
                            <span className="text-[9px] text-violet-400/60 font-mono">#{ticket.tags.length}</span>
                          )}
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
                onLeaveToggle={(memberId, date, active) => send({ type: "UPDATE_LEAVE", memberId, date, active })}
                onCalendarSaved={() => send({ type: "PUSH_CALENDAR" })}
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
              <Button onClick={startSession} size="lg">
                <Play className="w-4 h-4" />
                Start session{checkedIn.length > 0 ? ` (${checkedIn.length} checked in)` : ""}
              </Button>
              {checkedIn.length === 0 && (
                <p className="text-xs text-white/30">No participants yet — you can start and they can join while voting.</p>
              )}

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
                    {(session.product.dependencyTypes?.length ? session.product.dependencyTypes : ["SAP", "Network Team", "UI/UX", "Security", "Data"]).map((dep) => {
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
            <div className="flex flex-col flex-1 min-h-0">
            <div className="flex flex-col items-center gap-6 px-8 py-8 flex-1 overflow-y-auto">

              {/* Ticket node — centered card */}
              <TicketNode
                ticket={currentTicket}
                assignee={currentAssignee}
                jiraAssigneeName={currentTicket.jiraAssigneeName}
                jiraBaseUrl={session.product.jiraBaseUrl}
                priority={currentTicket.priority}
              />

              {/* Tabbed role notes */}
              <div className="w-full max-w-2xl space-y-1">
                <div className="flex items-center gap-1 mb-1">
                  {(["general", "DEV", "QA", "UI_UX"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setNoteTab(tab)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        noteTab === tab
                          ? "bg-violet-600/30 border border-violet-400/40 text-violet-300"
                          : "text-white/30 hover:text-white/60 border border-transparent hover:border-white/15"
                      }`}
                    >
                      {tab === "general" ? "General" : tab === "UI_UX" ? "UI/UX" : tab}
                    </button>
                  ))}
                  <span className="text-[10px] text-white/20 ml-2">Auto-synced · role-filtered on client</span>
                </div>
                <textarea
                  value={noteTab === "general" ? getNote(currentTicket.id) : getRoleNote(currentTicket.id, noteTab)}
                  onChange={(e) => {
                    if (noteTab === "general") {
                      setNote2(currentTicket.id, e.target.value);
                      pushNoteToMembers(currentTicket.id, e.target.value);
                    } else {
                      setRoleNote(currentTicket.id, noteTab, e.target.value);
                      if (noteUpdateTimer.current) clearTimeout(noteUpdateTimer.current);
                      noteUpdateTimer.current = setTimeout(() => {
                        send({ type: "UPDATE_NOTE", ticketId: currentTicket.id, note: e.target.value, noteRole: noteTab });
                      }, 800);
                    }
                  }}
                  placeholder={`${noteTab === "general" ? "General" : noteTab === "UI_UX" ? "UI/UX" : noteTab} note — auto-synced to ${noteTab === "general" ? "all members" : noteTab + " members"}`}
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/3 px-3 py-2 text-sm text-white placeholder:text-white/15 focus:border-violet-500/50 focus:outline-none resize-none"
                />
              </div>

              {/* Dependencies */}
              <div className="w-full max-w-2xl space-y-2">
                <p className="text-xs text-white/30 uppercase tracking-widest font-medium">Dependencies</p>
                <div className="flex flex-wrap gap-2">
                  {(session.product.dependencyTypes?.length ? session.product.dependencyTypes : ["SAP", "Network Team", "UI/UX", "Security", "Data"]).map((dep) => {
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

              {/* Risk flags (shown to all, editable by host) */}
              {(() => {
                const flags = ticketFlags[currentTicket.id] ?? [];
                const FLAG_OPTIONS = ["Needs spike", "Has dependency", "Missing AC", "Blocked"];
                return (
                  <div className="w-full max-w-2xl space-y-1.5">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Risk flags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FLAG_OPTIONS.map((flag) => {
                        const active = flags.includes(flag);
                        return (
                          <button
                            key={flag}
                            onClick={() => {
                              send({ type: "TICKET_FLAGGED", ticketId: currentTicket.id, flag, active: !active });
                            }}
                            className={`px-2.5 py-0.5 rounded-full border text-xs font-medium transition-all ${
                              active
                                ? "border-rose-500/60 bg-rose-500/15 text-rose-300"
                                : "border-white/10 bg-white/3 text-white/30 hover:border-white/25 hover:text-white/60"
                            }`}
                          >
                            {active ? "⚑" : "⚐"} {flag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Countdown ring + timer expired banner */}
              {timerDuration && timerStartedAt && !revealedVotes && (
                <div className="w-full max-w-2xl flex items-center gap-4">
                  <CountdownRing
                    duration={timerDuration}
                    startedAt={timerStartedAt}
                    size={56}
                    onExpire={() => setTimerExpired(true)}
                  />
                  {timerExpired && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold"
                    >
                      Time&apos;s up — reveal when ready
                    </motion.div>
                  )}
                </div>
              )}

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
                  <Button
                    onClick={reveal}
                    variant={timerExpired ? "danger" : "success"}
                    disabled={votedCount === 0}
                    className={`self-start${timerExpired ? " animate-pulse" : ""}`}
                  >
                    <Eye className="w-4 h-4" />
                    Reveal votes
                    {votedCount > 0 && <span className="opacity-50 font-mono text-xs ml-1">({votedCount})</span>}
                  </Button>
                )}
              </div>

              {/* Post-reveal */}
              {revealedVotes && revealMeta && (
                <div className="w-full max-w-2xl space-y-5">
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
                        {ICON_MAP[autoReaction.iconKey] ?? autoReaction.iconKey}
                        {autoReaction.label}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Flip cards */}
                  <div className="flex flex-wrap gap-3">
                    {revealedVotes.map((vote, i) => {
                      const member = checkedIn.find((c) => c.memberId === vote.memberId);
                      return (
                        <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value}
                          median={revealMeta.median} delay={i * 0.08} role={member?.role}
                          voteHistory={memberVoteHistory[vote.memberId] ?? []} />
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

                </div>
              )}
            </div>

            {/* ── Sticky lock bar — always visible at bottom of panel ── */}
            {revealedVotes && (
              <div className="shrink-0 border-t border-white/8 bg-black/20 px-8 py-4">
                {!lockedTickets.has(currentTicket.id) ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Compact SP chips */}
                    <div className="flex gap-1.5 flex-wrap">
                      {FIBONACCI_VALUES.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSelectedEstimate(v)}
                          className={`w-9 h-9 rounded-lg border-2 font-bold text-sm transition-all ${
                            selectedEstimate === v
                              ? "border-violet-400 bg-violet-600/40 text-white scale-110"
                              : "border-white/15 text-white/40 hover:border-violet-400/60 hover:text-white"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="w-px h-8 bg-white/10 shrink-0" />
                    <AssignmentPicker members={checkedIn} selectedMemberId={selectedAssigneeId} onChange={setSelectedAssigneeId} />
                    <div className="w-px h-8 bg-white/10 shrink-0" />
                    <div className="flex items-center gap-3">
                      <Button onClick={lockEstimate} disabled={selectedEstimate === null || !selectedAssigneeId || savingLock} variant="success">
                        <Lock className="w-4 h-4" />
                        {savingLock ? "Saving..." : `Lock${selectedEstimate ? ` — ${selectedEstimate} pts` : ""}`}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Estimate locked</span>
                    </div>
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

      {/* Switch-ticket confirmation dialog */}
      <AnimatePresence>
        {switchConfirmTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1625] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div>
                <h3 className="text-white font-semibold text-lg">Switch ticket?</h3>
                <p className="text-white/50 text-sm mt-1">
                  Voting is in progress. Switching will reset all current votes.
                </p>
                <p className="text-violet-300 text-sm mt-2 font-medium truncate">
                  → {switchConfirmTicket.jiraKey}: {switchConfirmTicket.title}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSwitchConfirmTicket(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-white/15 text-white/60 hover:text-white/80 hover:border-white/25 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { openTicket(switchConfirmTicket); setSwitchConfirmTicket(null); }}
                  className="flex-1 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium transition-colors text-sm"
                >
                  Switch &amp; reset votes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {recapDurationMin !== null && (
                    <p className="flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="w-3 h-3" />
                      Duration: {recapDurationMin} min
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
                <Button variant="ghost" onClick={closeRecap}>
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Team Awards ceremony overlay */}
      {showAwardsCeremony && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div style={{
            background: "linear-gradient(160deg, #0c0a1c 0%, #100e20 100%)",
            border: "1px solid #ffffff10",
            borderRadius: 24,
            padding: "36px 28px",
            width: "100%",
            maxWidth: 420,
            margin: "0 16px",
            boxShadow: "0 32px 80px #00000099",
            maxHeight: "85vh",
            overflowY: "auto",
          }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 56, height: 56, background: "radial-gradient(circle, #7c3aed33, transparent)", border: "1.5px solid #7c3aed66", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 0 24px #7c3aed44" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "white", letterSpacing: "-0.01em" }}>Team Awards</h2>
              <p style={{ fontSize: 12, color: "#6b5fa6", marginTop: 4 }}>{session.sprintName}</p>
            </div>

            {sessionAchievements.length > 0 ? (
              <div>
                {sessionAchievements.map((a, i) => {
                  const m = session.product.members.find((mem) => mem.id === a.memberId);
                  const cfg = BADGE_CONFIG[a.type as AchievementType];
                  const initials = m ? m.name.trim().split(/\s+/).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() : "?";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < sessionAchievements.length - 1 ? "1px solid #ffffff06" : "none" }}>
                      <AchievementBadge type={a.type as AchievementType} size="sm" showTooltip />
                      <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: cfg.color }}>{cfg.name}</span>
                      {m && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#ffffff08", borderRadius: 20, padding: "3px 10px 3px 4px" }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: `${cfg.glow}55`, border: `1px solid ${cfg.glow}55`, color: cfg.color }}>
                            {initials}
                          </div>
                          <span style={{ fontSize: 11, color: "#ffffff60" }}>{m.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#ffffff25", textAlign: "center" }}>No badges awarded this session.</p>
            )}

            <button
              onClick={() => setShowAwardsCeremony(false)}
              style={{ marginTop: 22, width: "100%", padding: 12, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 12, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px #7c3aed44" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Oracle flash toasts */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 55, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <AnimatePresence>
          {oracleToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#0f0d1e",
                border: "1px solid #7c3aed33",
                borderRadius: 14, padding: "10px 16px 10px 10px",
                boxShadow: "0 4px 24px #00000060",
              }}
            >
              <AchievementBadge type="ORACLE" size="sm" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2d9ff" }}>
                  {toast.memberName} called it{" "}
                  <span style={{ fontSize: 10, backgroundColor: "#7c3aed33", color: "#c4b5fd", borderRadius: 6, padding: "2px 7px", fontWeight: 700, marginLeft: 4 }}>
                    Oracle
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#6b5fa6", marginTop: 2 }}>
                  Voted {toast.value} · Final was {toast.value}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
