"use client";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, CheckedInMember, RevealedVote, PublicState } from "@/types/partykit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealCard } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { AssignmentPicker } from "@/components/session/AssignmentPicker";
import { BandwidthRail } from "@/components/session/BandwidthRail";
import { BulkAssignDrawer } from "@/components/session/BulkAssignDrawer";
import type { Ticket, Member, SessionParticipant, Vote } from "@/types/models";
import { FIBONACCI_VALUES } from "@/lib/utils";
import { Check, ChevronRight, Copy, Eye, GitMerge, Lock, Play, Users } from "lucide-react";
import confetti from "canvas-confetti";

type TicketWithVotes = Ticket & { votes: (Vote & { member: Member })[] };
type ParticipantWithMember = SessionParticipant & { member: Member };

interface PokerSession {
  id: string;
  sprintName: string;
  status: string;
  tickets: TicketWithVotes[];
  participants: ParticipantWithMember[];
  product: { id: string; members: Member[]; jiraBaseUrl?: string | null };
}

export function HostView({ session, productId: _productId }: { session: PokerSession; productId: string }) {
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
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);

  // Local tickets state (mutable for bulk assign updates)
  const [tickets, setTickets] = useState(session.tickets);

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${session.id}` : "";

  const applyState = useCallback((state: PublicState) => {
    setSessionStatus(state.sessionStatus);
    setCheckedIn(state.checkedIn);
    setCurrentTicketId(state.currentTicket?.ticketId ?? null);
    setVotedMemberIds(state.votedMemberIds);
    setVotedCount(state.votedMemberIds.length);
    setRevealedVotes(state.revealedVotes);
    setLockedTickets(new Set(state.lockedTickets));
    setTicketAssignees(state.lockedTicketAssignees ?? {});
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
      case "STATE_SYNC":
        applyState(msg.state);
        break;
      case "PRESENCE_UPDATE":
        setCheckedIn(msg.checkedIn);
        break;
      case "SESSION_STARTED":
        setSessionStatus("ACTIVE");
        break;
      case "TICKET_OPENED":
        setCurrentTicketId(msg.ticketId);
        setVotedMemberIds([]);
        setVotedCount(0);
        setRevealedVotes(null);
        setRevealMeta(null);
        setSelectedEstimate(null);
        setSelectedAssigneeId(null);
        setNote("");
        break;
      case "VOTE_PROGRESS":
        setVotedMemberIds(msg.votedMemberIds);
        setVotedCount(msg.votedCount);
        break;
      case "VOTES_REVEALED":
        setRevealedVotes(msg.votes);
        setRevealMeta({ median: msg.median, isConsensus: msg.isConsensus });
        if (msg.isConsensus) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        break;
      case "ESTIMATE_LOCKED":
        setLockedTickets((l) => new Set([...l, msg.ticketId]));
        if (msg.assigneeId) setTicketAssignees((a) => ({ ...a, [msg.ticketId]: msg.assigneeId! }));
        setCurrentTicketId(null);
        setRevealedVotes(null);
        setRevealMeta(null);
        break;
      case "REACTION_RECEIVED":
        setReactions((r) => [...r.slice(-20), msg]);
        break;
    }
  }, [applyState]));

  const currentTicket = tickets.find((t) => t.id === currentTicketId) ?? null;

  const startSession = () => send({ type: "START_SESSION" });

  const openTicket = (t: TicketWithVotes) =>
    send({ type: "OPEN_TICKET", ticketId: t.id, jiraKey: t.jiraKey, title: t.title, description: t.description ?? undefined });

  const reveal = () => send({ type: "REVEAL_VOTES" });

  const lockEstimate = async () => {
    if (!currentTicket || selectedEstimate === null) return;
    setSavingLock(true);
    send({
      type: "LOCK_ESTIMATE",
      ticketId: currentTicket.id,
      value: selectedEstimate,
      note: note || undefined,
      assigneeId: selectedAssigneeId ?? undefined,
    });
    await fetch(`/api/sessions/${session.id}/tickets/${currentTicket.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: selectedEstimate, note, votes: revealedVotes ?? [], assigneeId: selectedAssigneeId }),
    });
    setSavingLock(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Bandwidth rail data: use checkedIn to filter product members to those present
  const presentMembers = session.product.members
    .filter((m) => checkedIn.some((c) => c.memberId === m.id))
    .map((m) => ({
      memberId: m.id,
      memberName: m.name,
      role: m.role,
      capacity: (m as Member & { capacity?: number }).capacity ?? 20,
    }));

  // Enrich tickets with current assignee state
  const enrichedTickets = tickets.map((t) => ({
    ...t,
    assigneeId: ticketAssignees[t.id] ?? t.assigneeId,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-lg">🃏</span>
          <div>
            <p className="text-white font-semibold text-sm">{session.sprintName}</p>
            <p className="text-white/40 text-xs">Host View</p>
          </div>
          <Badge variant={sessionStatus === "ACTIVE" ? "warning" : sessionStatus === "COMPLETED" ? "success" : "ghost"}>
            {sessionStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {lockedTickets.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setBulkDrawerOpen(true)}>
              <GitMerge className="w-3.5 h-3.5" />
              Bulk Assign
              <span className="ml-1 text-violet-400">{lockedTickets.size}</span>
            </Button>
          )}
          <button onClick={copyLink} className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors border border-white/10 rounded-lg px-3 py-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Share Link"}
          </button>
          <div className="flex items-center gap-1.5 text-sm text-white/40">
            <Users className="w-4 h-4" />
            {checkedIn.length}/{session.product.members.length}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Ticket sidebar */}
        <aside className="w-72 border-r border-white/10 bg-white/3 backdrop-blur-sm flex flex-col h-full">
          <div className="p-4 border-b border-white/10 shrink-0">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
              Tickets ({tickets.length})
            </p>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {tickets.map((ticket) => {
              const isLocked = lockedTickets.has(ticket.id) || ticket.status === "ESTIMATED";
              const isCurrent = currentTicketId === ticket.id;
              const assigneeId = ticketAssignees[ticket.id] ?? ticket.assigneeId;
              const assignee = assigneeId ? session.product.members.find((m) => m.id === assigneeId) : null;
              return (
                <button
                  key={ticket.id}
                  onClick={() => !isLocked && sessionStatus === "ACTIVE" && openTicket(ticket)}
                  disabled={isLocked || sessionStatus !== "ACTIVE"}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                    isCurrent ? "bg-violet-600/20 border border-violet-500/50"
                    : isLocked ? "opacity-40 cursor-not-allowed border border-transparent"
                    : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-violet-400 shrink-0 mt-0.5">{ticket.jiraKey}</span>
                    <span className="text-xs text-white/70 leading-relaxed line-clamp-2 flex-1">{ticket.title}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-auto mt-0.5">
                      {assignee && <MemberAvatar name={assignee.name} role={assignee.role} size={16} />}
                      {isLocked && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main game area */}
        <main className="flex-1 overflow-y-auto">
          {/* WAITING */}
          {sessionStatus === "WAITING" && (
            <div className="flex flex-col items-center justify-center gap-8 p-12 h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Waiting for team</h2>
                <p className="text-white/40 text-sm">Share the link — members click their name to check in</p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 max-w-md w-full">
                <span className="text-white/60 text-sm truncate flex-1">{joinUrl}</span>
                <button onClick={copyLink} className="text-violet-400 hover:text-violet-300 shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {/* Presence list with role-aware avatars */}
              <div className="flex flex-wrap gap-3 justify-center max-w-md">
                {session.product.members.map((m) => {
                  const isIn = checkedIn.some((c) => c.memberId === m.id);
                  return (
                    <motion.div
                      key={m.id}
                      animate={isIn ? { scale: [1, 1.1, 1] } : {}}
                      className="flex items-center gap-2"
                    >
                      <MemberAvatar name={m.name} role={m.role} size={36} showRing={isIn} dimmed={!isIn} />
                    </motion.div>
                  );
                })}
              </div>
              <Button onClick={startSession} size="lg" disabled={checkedIn.length === 0}>
                <Play className="w-4 h-4" />
                Start Session ({checkedIn.length} checked in)
              </Button>
            </div>
          )}

          {/* ACTIVE — no ticket selected */}
          {sessionStatus === "ACTIVE" && !currentTicket && (
            <div className="flex items-center justify-center h-full text-white/30">
              <p>← Pick a ticket to open voting</p>
            </div>
          )}

          {/* ACTIVE — ticket open */}
          {sessionStatus === "ACTIVE" && currentTicket && (
            <div className="p-8 flex flex-col gap-6 max-w-3xl">
              {/* Ticket info */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-violet-400 font-mono text-sm font-bold">{currentTicket.jiraKey}</span>
                  <Badge variant={revealedVotes ? "success" : "warning"}>
                    {revealedVotes ? "Revealed" : "Voting"}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-white leading-snug">{currentTicket.title}</h2>
              </div>

              {/* Vote progress bar */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-violet-500 rounded-full"
                    animate={{ width: checkedIn.length > 0 ? `${(votedCount / checkedIn.length) * 100}%` : "0%" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
                <span className="text-sm text-white/50 shrink-0 tabular-nums">
                  {votedCount}/{checkedIn.length} voted
                </span>
              </div>

              {/* Member vote indicators with role avatars */}
              <div className="flex flex-wrap gap-3">
                {checkedIn.map((m) => {
                  const hasVoted = votedMemberIds.includes(m.memberId);
                  return (
                    <div key={m.memberId} className="flex flex-col items-center gap-1">
                      <MemberAvatar name={m.memberName} role={m.role} size={40} showRing={hasVoted} dimmed={!hasVoted} />
                      <span className="text-[10px] text-white/30 max-w-[40px] truncate text-center">{m.memberName.split(" ")[0]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Before reveal */}
              {!revealedVotes && (
                <Button onClick={reveal} variant="success" size="lg" disabled={votedCount === 0} className="self-start">
                  <Eye className="w-4 h-4" />
                  Reveal Votes
                  {votedCount > 0 && <span className="ml-1 opacity-60">({votedCount})</span>}
                </Button>
              )}

              {/* After reveal */}
              {revealedVotes && revealMeta && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4">
                    {revealedVotes.map((vote, i) => {
                      const member = checkedIn.find((c) => c.memberId === vote.memberId);
                      return (
                        <RevealCard
                          key={vote.memberId}
                          memberName={vote.memberName}
                          value={vote.value}
                          median={revealMeta.median}
                          delay={i * 0.08}
                          role={member?.role}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/40">
                      Median: <span className="text-white font-bold">{revealMeta.median}</span>
                    </span>
                    {revealMeta.isConsensus && (
                      <span className="text-emerald-400 font-semibold">🎉 Full consensus!</span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Reactions</p>
                    <EmojiReaction
                      reactions={reactions}
                      onReact={(emoji) => send({ type: "REACTION", memberId: "host", memberName: "Host", emoji })}
                    />
                  </div>

                  {/* Lock estimate */}
                  {!lockedTickets.has(currentTicket.id) ? (
                    <div className="border-t border-white/10 pt-6 space-y-4">
                      <p className="text-sm text-white/50 font-medium">Lock final estimate</p>
                      <div className="flex gap-2 flex-wrap">
                        {FIBONACCI_VALUES.map((v) => (
                          <button
                            key={v}
                            onClick={() => setSelectedEstimate(v)}
                            className={`w-11 h-16 rounded-xl border-2 font-bold text-lg transition-all ${
                              selectedEstimate === v
                                ? "border-violet-400 bg-violet-600 text-white scale-110"
                                : "border-white/20 text-white/60 hover:border-violet-400 hover:text-white hover:scale-105"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Note (optional — will be posted to JIRA)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
                      />
                      <AssignmentPicker
                        members={checkedIn}
                        selectedMemberId={selectedAssigneeId}
                        onChange={setSelectedAssigneeId}
                      />
                      <Button
                        onClick={lockEstimate}
                        disabled={selectedEstimate === null || savingLock}
                        variant="success"
                        size="lg"
                      >
                        <Lock className="w-4 h-4" />
                        {savingLock ? "Saving..." : `Lock ${selectedEstimate ? `— ${selectedEstimate} pts` : ""}`}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-400 pt-2">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Locked & synced to JIRA</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Bandwidth rail */}
        {sessionStatus !== "WAITING" && (
          <BandwidthRail
            members={presentMembers}
            estimatedTickets={enrichedTickets}
            pendingAssigneeId={selectedAssigneeId}
            pendingEstimate={selectedEstimate}
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
    </div>
  );
}
