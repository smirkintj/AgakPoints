"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, RevealedVote, CheckedInMember } from "@/types/partykit";
import type { Ticket, Member, Product, PokerSession } from "@/types/models";
import { VotingCard } from "@/components/session/VotingCard";
import { RevealCard } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { FIBONACCI_VALUES, isConsensus } from "@/lib/utils";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { TicketTypeIcon } from "@/components/session/TicketTypeIcon";
import { Check, Clock, Sparkles } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  Highest: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#3b82f6", Lowest: "#6b7280",
};
import confetti from "canvas-confetti";

type SessionWithDetails = PokerSession & {
  tickets: Ticket[];
  product: Product & { members: Member[] };
};

export function ParticipantView({ session }: { session: SessionWithDetails }) {
  const [member, setMember] = useState<Member | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInMember[]>([]);
  const [currentTicket, setCurrentTicket] = useState<{ ticketId: string; jiraKey: string; title: string; contextNote?: string; issueType?: string; priority?: string } | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [votedMemberIds, setVotedMemberIds] = useState<string[]>([]);
  const [revealedVotes, setRevealedVotes] = useState<RevealedVote[] | null>(null);
  const [revealMeta, setRevealMeta] = useState<{ median: number; isConsensus: boolean } | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (stored) setMember(JSON.parse(stored));
  }, [session.id]);

  const { send } = usePartyRoom(session.id, useCallback((msg: MsgOut) => {
    switch (msg.type) {
      case "STATE_SYNC": {
        const s = msg.state;
        setCheckedIn(s.checkedIn);
        setCurrentTicket(s.currentTicket ? { ticketId: s.currentTicket.ticketId, jiraKey: s.currentTicket.jiraKey, title: s.currentTicket.title, contextNote: s.currentTicket.contextNote, issueType: s.currentTicket.issueType, priority: s.currentTicket.priority } : null);
        setVotedMemberIds(s.votedMemberIds);
        setRevealedVotes(s.revealedVotes);
        setLockedTickets(new Set(s.lockedTickets));
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
        setCurrentTicket({ ticketId: msg.ticketId, jiraKey: msg.jiraKey, title: msg.title, contextNote: msg.contextNote, issueType: msg.issueType, priority: msg.priority });
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
        setCurrentTicket(null);
        break;
      case "REACTION_RECEIVED":
        setReactions((r) => [...r.slice(-20), msg]);
        break;
    }
  }, []));

  const castVote = useCallback((value: number) => {
    if (!member || myVote !== null || !currentTicket || revealedVotes) return;
    setMyVote(value);
    send({ type: "VOTE_CAST", memberId: member.id, value });
  }, [member, myVote, currentTicket, revealedVotes, send]);

  const sendReaction = useCallback((emoji: string) => {
    if (!member) return;
    send({ type: "REACTION", memberId: member.id, memberName: member.name, emoji });
  }, [member, send]);

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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{session.product.name}</p>
          <p className="text-white/40 text-xs">{session.sprintName}</p>
        </div>
        <div className="flex items-center gap-2">
          <MemberAvatar name={member.name} role={member.role} size={28} showRing />
          <span className="text-white/60 text-sm">{member.name}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <AnimatePresence mode="wait">
          {!currentTicket ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-5 h-5 text-violet-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Waiting for host</h2>
              <p className="text-white/40 text-sm">The host will open a ticket to vote on.</p>
              <div className="flex justify-center gap-1.5 mt-6">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
              {/* Show who else is here */}
              {checkedIn.length > 1 && (
                <div className="mt-6 flex flex-wrap gap-1.5 justify-center">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg space-y-8"
            >
              {/* Ticket info */}
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-5 space-y-3">
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
                <h2 className="text-xl font-bold text-white leading-snug">{currentTicket.title}</h2>
              </div>
              {currentTicket.contextNote && (
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3">
                  <p className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-widest mb-1">Host notes</p>
                  <p className="text-sm text-white/60 leading-relaxed">{currentTicket.contextNote}</p>
                </div>
              )}

              {/* Voting cards */}
              {!revealedVotes && (
                <div className="space-y-4">
                  <p className="text-center text-white/40 text-sm">
                    {myVote !== null ? `You voted ${myVote} — waiting for reveal...` : "Pick your estimate"}
                  </p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    {FIBONACCI_VALUES.map((v) => (
                      <VotingCard key={v} value={v} selected={myVote === v} disabled={myVote !== null} onSelect={castVote} />
                    ))}
                  </div>
                </div>
              )}

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
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4 justify-center">
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
                      <span className="ml-2 flex items-center gap-1 text-emerald-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" /> Consensus
                      </span>
                    )}
                  </div>
                  <div className="border-t border-white/10 pt-4 flex justify-center">
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
      </main>
    </div>
  );
}
