"use client";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import type { SessionEvent } from "@/types/ably";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RevealCard, calcMedian } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import type { Ticket, Member, SessionParticipant, Vote } from "@/types/models";
import { isConsensus, FIBONACCI_VALUES } from "@/lib/utils";
import { Check, ChevronRight, Copy, Eye, Lock, Play, Users } from "lucide-react";
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

interface HostViewProps {
  session: PokerSession;
  productId: string;
}

export function HostView({ session, productId }: HostViewProps) {
  const [status, setStatus] = useState(session.status);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<{ memberId: string; memberName: string }[]>([]);
  const [voteProgress, setVoteProgress] = useState({ votedCount: 0, totalCount: 0, votedMemberIds: [] as string[] });
  const [revealedVotes, setRevealedVotes] = useState<{ memberId: string; memberName: string; value: number }[] | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${session.id}` : "";

  useSessionChannel(session.id, (event: SessionEvent) => {
    switch (event.type) {
      case "PRESENCE_UPDATE":
        setCheckedIn(event.checkedIn);
        break;
      case "SESSION_STARTED":
        setStatus("ACTIVE");
        break;
      case "TICKET_OPENED":
        setCurrentTicketId(event.ticketId);
        setRevealedVotes(null);
        setVoteProgress({ votedCount: 0, totalCount: checkedIn.length, votedMemberIds: [] });
        setSelectedEstimate(null);
        setNote("");
        break;
      case "VOTE_PROGRESS":
        setVoteProgress({ votedCount: event.votedCount, totalCount: event.totalCount, votedMemberIds: event.votedMemberIds });
        break;
      case "VOTES_REVEALED":
        setRevealedVotes(event.votes);
        if (isConsensus(event.votes.map((v) => v.value))) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        break;
      case "ESTIMATE_LOCKED":
        setLocked((l) => new Set([...l, event.ticketId]));
        break;
      case "REACTION_RECEIVED":
        setReactions((r) => [...r, { memberId: event.memberId, memberName: event.memberName, emoji: event.emoji }]);
        break;
    }
  });

  const apiPost = useCallback((path: string, body: object) =>
    fetch(`/api/sessions/${session.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }), [session.id]);

  const startSession = () => apiPost("start", {});

  const openTicket = (ticketId: string) => apiPost("ticket", { ticketId });

  const reveal = () => {
    if (!currentTicketId) return;
    apiPost("reveal", { ticketId: currentTicketId });
  };

  const lockEstimate = async (ticketId: string) => {
    if (selectedEstimate === null) return;
    await apiPost(`tickets/${ticketId}/lock`, { value: selectedEstimate, note, votes: revealedVotes ?? [] });
    setLocked((l) => new Set([...l, ticketId]));
  };

  const sendReaction = (emoji: string) =>
    apiPost("react", { memberId: "admin", memberName: session.product.members[0]?.name ?? "Admin", emoji });

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTicket = session.tickets.find((t) => t.id === currentTicketId);
  const median = revealedVotes ? calcMedian(revealedVotes.map((v) => v.value)) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-lg">🃏</span>
          <div>
            <p className="text-white font-semibold text-sm">{session.sprintName}</p>
            <p className="text-white/40 text-xs">Host View</p>
          </div>
          <Badge variant={status === "ACTIVE" ? "warning" : status === "COMPLETED" ? "success" : "ghost"}>
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Ticket List */}
        <aside className="w-72 border-r border-white/10 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-white/10">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
              Tickets ({session.tickets.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {session.tickets.map((ticket) => {
              const isLocked = locked.has(ticket.id) || ticket.status === "ESTIMATED";
              const isCurrent = currentTicketId === ticket.id;
              return (
                <button
                  key={ticket.id}
                  onClick={() => !isLocked && status === "ACTIVE" && openTicket(ticket.id)}
                  disabled={isLocked || status !== "ACTIVE"}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                    isCurrent
                      ? "bg-violet-600/20 border border-violet-500/50"
                      : isLocked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-violet-400 shrink-0 mt-0.5">{ticket.jiraKey}</span>
                    <span className="text-xs text-white/70 leading-relaxed line-clamp-2">{ticket.title}</span>
                    {isLocked && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-auto" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main: Game Area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {status === "WAITING" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Waiting for team to check in</h2>
                <p className="text-white/40">Share the link below so your team can join</p>
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 max-w-md w-full">
                <span className="text-white/60 text-sm truncate flex-1">{joinUrl}</span>
                <button onClick={copyLink} className="text-violet-400 hover:text-violet-300 transition-colors shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-w-md justify-center">
                {session.product.members.map((member) => {
                  const isIn = checkedIn.some((c) => c.memberId === member.id);
                  return (
                    <div key={member.id} className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all ${
                      isIn ? "bg-emerald-600/20 border border-emerald-500/50 text-emerald-300" : "bg-white/5 border border-white/10 text-white/30"
                    }`}>
                      {isIn ? "✓" : "○"} {member.name}
                    </div>
                  );
                })}
              </div>
              <Button onClick={startSession} size="lg" disabled={checkedIn.length === 0}>
                <Play className="w-4 h-4" />
                Start Session ({checkedIn.length} checked in)
              </Button>
            </div>
          )}

          {status === "ACTIVE" && !currentTicket && (
            <div className="flex-1 flex items-center justify-center text-white/30">
              <p>Select a ticket from the left to start voting</p>
            </div>
          )}

          {status === "ACTIVE" && currentTicket && (
            <div className="flex-1 p-8 flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-violet-400 font-mono text-sm">{currentTicket.jiraKey}</span>
                  <Badge variant="warning">Voting</Badge>
                </div>
                <h2 className="text-xl font-bold text-white">{currentTicket.title}</h2>
              </div>

              {/* Vote progress */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-violet-600 rounded-full"
                    animate={{ width: voteProgress.totalCount > 0 ? `${(voteProgress.votedCount / voteProgress.totalCount) * 100}%` : "0%" }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
                <span className="text-sm text-white/50 shrink-0">
                  {voteProgress.votedCount}/{voteProgress.totalCount} voted
                </span>
              </div>

              {/* Voter avatars */}
              <div className="flex flex-wrap gap-3">
                {checkedIn.map((member) => {
                  const hasVoted = voteProgress.votedMemberIds.includes(member.memberId);
                  return (
                    <div key={member.memberId} className={`flex flex-col items-center gap-1 transition-all ${hasVoted ? "voted-glow" : ""}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        hasVoted ? "bg-violet-600 text-white ring-2 ring-violet-400" : "bg-white/10 text-white/40"
                      }`}>
                        {member.memberName[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs text-white/40">{hasVoted ? "✓" : "..."}</span>
                    </div>
                  );
                })}
              </div>

              {!revealedVotes ? (
                <Button onClick={reveal} variant="success" size="lg" disabled={voteProgress.votedCount === 0} className="self-start">
                  <Eye className="w-4 h-4" />
                  Reveal Votes
                </Button>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm text-white/40 mb-4">Votes revealed</p>
                    <div className="flex flex-wrap gap-4">
                      {revealedVotes.map((vote, i) => (
                        <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value} median={median} delay={i * 0.1} />
                      ))}
                    </div>
                    {revealedVotes.length > 0 && (
                      <p className="text-white/40 text-sm mt-4">
                        Median: <span className="text-white font-bold">{median}</span>
                        {isConsensus(revealedVotes.map((v) => v.value)) && (
                          <span className="ml-2 text-emerald-400">🎉 Consensus!</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="relative">
                    <p className="text-xs text-white/40 mb-2">Reactions</p>
                    <EmojiReaction reactions={reactions} onReact={sendReaction} />
                  </div>

                  {!locked.has(currentTicket.id) && (
                    <div className="border-t border-white/10 pt-6">
                      <p className="text-sm text-white/60 mb-3">Lock final estimate:</p>
                      <div className="flex gap-2 flex-wrap mb-4">
                        {FIBONACCI_VALUES.map((v) => (
                          <button
                            key={v}
                            onClick={() => setSelectedEstimate(v)}
                            className={`w-10 h-14 rounded-lg border text-sm font-bold transition-all ${
                              selectedEstimate === v
                                ? "border-violet-400 bg-violet-600 text-white"
                                : "border-white/20 text-white/60 hover:border-violet-400 hover:text-white"
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none mb-3"
                      />
                      <Button onClick={() => lockEstimate(currentTicket.id)} disabled={selectedEstimate === null} variant="success">
                        <Lock className="w-4 h-4" />
                        Lock {selectedEstimate ? `(${selectedEstimate} pts)` : ""}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {locked.has(currentTicket.id) && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Check className="w-4 h-4" />
                      <span className="text-sm">Estimate locked & synced to JIRA</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
