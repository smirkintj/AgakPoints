"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import type { SessionEvent } from "@/types/ably";
import type { Ticket, Member, Product, PokerSession } from "@/types/models";
import { VotingCard } from "@/components/session/VotingCard";
import { RevealCard, calcMedian } from "@/components/session/RevealCard";
import { EmojiReaction } from "@/components/session/EmojiReaction";
import { FIBONACCI_VALUES, isConsensus } from "@/lib/utils";
import confetti from "canvas-confetti";

type SessionWithDetails = PokerSession & {
  tickets: Ticket[];
  product: Product & { members: Member[] };
};

export function ParticipantView({ session }: { session: SessionWithDetails }) {
  const [member, setMember] = useState<Member | null>(null);
  const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [votedMemberIds, setVotedMemberIds] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState<{ memberId: string; memberName: string }[]>([]);
  const [revealedVotes, setRevealedVotes] = useState<{ memberId: string; memberName: string; value: number }[] | null>(null);
  const [reactions, setReactions] = useState<{ memberId: string; memberName: string; emoji: string }[]>([]);
  const [lockedTickets, setLockedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (stored) setMember(JSON.parse(stored));
  }, [session.id]);

  useSessionChannel(session.id, (event: SessionEvent) => {
    switch (event.type) {
      case "PRESENCE_UPDATE":
        setCheckedIn(event.checkedIn);
        break;
      case "TICKET_OPENED": {
        const ticket = session.tickets.find((t: Ticket) => t.id === event.ticketId) ?? null;
        setCurrentTicket(ticket);
        setMyVote(null);
        setVotedMemberIds([]);
        setRevealedVotes(null);
        break;
      }
      case "VOTE_PROGRESS":
        setVotedMemberIds(event.votedMemberIds);
        break;
      case "VOTES_REVEALED":
        setRevealedVotes(event.votes);
        if (isConsensus(event.votes.map((v) => v.value))) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        break;
      case "ESTIMATE_LOCKED":
        setLockedTickets((l) => new Set([...l, event.ticketId]));
        break;
      case "REACTION_RECEIVED":
        setReactions((r) => [...r, { memberId: event.memberId, memberName: event.memberName, emoji: event.emoji }]);
        break;
    }
  });

  const castVote = useCallback((value: number) => {
    if (!member || myVote !== null || revealedVotes) return;
    setMyVote(value);
    const currentTicketId = currentTicket?.id;
    if (!currentTicketId) return;
    fetch(`/api/sessions/${session.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, ticketId: currentTicketId, value }),
    });
  }, [member, myVote, revealedVotes, currentTicket, session.id]);

  const sendReaction = useCallback((emoji: string) => {
    if (!member) return;
    fetch(`/api/sessions/${session.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, memberName: member.name, emoji }),
    });
  }, [member, session.id]);

  const median = revealedVotes ? calcMedian(revealedVotes.map((v) => v.value)) : 0;

  if (!member) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 mb-4">Session identity not found.</p>
          <a href={`/join/${session.id}`} className="text-violet-400 hover:text-violet-300">
            Go back to check-in →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="border-b border-white/10 px-6 py-3 flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{session.product.name}</p>
          <p className="text-white/40 text-xs">{session.sprintName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-full bg-violet-600/40 flex items-center justify-center text-xs font-bold text-violet-300">
            {member.name[0]?.toUpperCase()}
          </div>
          <span className="text-white/60">{member.name}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {!currentTicket ? (
          <div className="text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-white mb-2">Waiting for admin...</h2>
            <p className="text-white/40 text-sm">The session host will open a ticket soon.</p>
            <div className="flex items-center justify-center gap-1.5 mt-6">
              {[0, 150, 300].map((delay) => (
                <div key={delay} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTicket.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg space-y-8"
            >
              <div className="text-center">
                <p className="text-violet-400 font-mono text-sm mb-2">{currentTicket.jiraKey}</p>
                <h2 className="text-xl font-bold text-white">{currentTicket.title}</h2>
              </div>

              {!revealedVotes && (
                <div>
                  <p className="text-center text-white/40 text-sm mb-6">
                    {myVote !== null ? `You voted ${myVote} ✓` : "Cast your vote"}
                  </p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    {FIBONACCI_VALUES.map((value) => (
                      <VotingCard key={value} value={value} selected={myVote === value} disabled={myVote !== null} onSelect={castVote} />
                    ))}
                  </div>
                </div>
              )}

              {!revealedVotes && (
                <div className="flex justify-center gap-2">
                  {checkedIn.map((c) => (
                    <div key={c.memberId} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      votedMemberIds.includes(c.memberId) ? "bg-violet-600 text-white" : "bg-white/10 text-white/30"
                    }`}>
                      {c.memberName[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
              )}

              {revealedVotes && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {revealedVotes.map((vote, i) => (
                      <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value} median={median} delay={i * 0.1} />
                    ))}
                  </div>
                  {isConsensus(revealedVotes.map((v) => v.value)) && (
                    <p className="text-center text-emerald-400 font-bold">🎉 Consensus!</p>
                  )}
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs text-white/40 mb-2 text-center">React</p>
                    <div className="flex justify-center">
                      <EmojiReaction reactions={reactions} onReact={sendReaction} />
                    </div>
                  </div>
                </div>
              )}

              {lockedTickets.has(currentTicket.id) && (
                <p className="text-center text-emerald-400 text-sm">✓ Estimate locked by admin</p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
