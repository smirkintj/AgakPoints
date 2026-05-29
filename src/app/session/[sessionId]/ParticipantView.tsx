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
import confetti from "canvas-confetti";

type SessionWithDetails = PokerSession & {
  tickets: Ticket[];
  product: Product & { members: Member[] };
};

export function ParticipantView({ session }: { session: SessionWithDetails }) {
  const [member, setMember] = useState<Member | null>(null);
  const [checkedIn, setCheckedIn] = useState<CheckedInMember[]>([]);
  const [currentTicket, setCurrentTicket] = useState<{ ticketId: string; jiraKey: string; title: string } | null>(null);
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
        setCurrentTicket(s.currentTicket);
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
        setCurrentTicket({ ticketId: msg.ticketId, jiraKey: msg.jiraKey, title: msg.title });
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🤔</p>
          <p className="text-white/60 mb-4">Who are you?</p>
          <a href={`/join/${session.id}`} className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
            Go back to check-in
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
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-600/40 flex items-center justify-center text-xs font-bold text-violet-300">
            {member.name[0]?.toUpperCase()}
          </div>
          <span className="text-white/60 text-sm">{member.name}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <AnimatePresence mode="wait">
          {!currentTicket ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-xl font-bold text-white mb-2">Waiting for host...</h2>
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
              <div className="text-center">
                <p className="text-violet-400 font-mono text-sm mb-2 font-bold">{currentTicket.jiraKey}</p>
                <h2 className="text-xl font-bold text-white leading-snug">{currentTicket.title}</h2>
              </div>

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
                  {checkedIn.map((c) => (
                    <div key={c.memberId} title={c.memberName} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      votedMemberIds.includes(c.memberId) ? "bg-violet-600 text-white ring-2 ring-violet-400" : "bg-white/10 text-white/30"
                    }`}>
                      {c.memberName[0]?.toUpperCase()}
                    </div>
                  ))}
                </div>
              )}

              {/* Revealed */}
              {revealedVotes && revealMeta && (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-4 justify-center">
                    {revealedVotes.map((vote, i) => (
                      <RevealCard key={vote.memberId} memberName={vote.memberName} value={vote.value} median={revealMeta.median} delay={i * 0.08} />
                    ))}
                  </div>
                  <div className="text-center text-sm text-white/40">
                    Median: <span className="text-white font-bold">{revealMeta.median}</span>
                    {revealMeta.isConsensus && <span className="ml-2 text-emerald-400 font-semibold">🎉 Consensus!</span>}
                  </div>
                  <div className="border-t border-white/10 pt-4 flex justify-center">
                    <EmojiReaction reactions={reactions} onReact={sendReaction} />
                  </div>
                </div>
              )}

              {lockedTickets.has(currentTicket.ticketId) && (
                <p className="text-center text-emerald-400 text-sm font-medium">✓ Estimate locked by host</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
