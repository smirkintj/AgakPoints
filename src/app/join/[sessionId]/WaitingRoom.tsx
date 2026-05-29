"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import usePartySocket from "partysocket/react";
import { motion, AnimatePresence } from "framer-motion";
import type { PartyClientMessage, PartyServerMessage } from "@/types/partykit";
import type { Member, PokerSession, Product, SessionParticipant } from "@/types/models";

type SessionWithDetails = PokerSession & {
  product: Product & { members: Member[] };
  participants: (SessionParticipant & { member: Member })[];
};

interface WaitingRoomProps {
  session: SessionWithDetails;
}

export function WaitingRoom({ session }: WaitingRoomProps) {
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState<{ memberId: string; memberName: string }[]>(
    session.participants
      .filter((p: SessionParticipant & { member: Member }) => p.checkedIn)
      .map((p: SessionParticipant & { member: Member }) => ({
        memberId: p.member.id,
        memberName: p.member.name,
      }))
  );
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const ws = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999",
    room: session.id,
    onMessage(event) {
      const msg = JSON.parse(event.data) as PartyServerMessage;
      if (msg.type === "PRESENCE_UPDATE") {
        setCheckedIn(msg.checkedIn);
      }
      if (msg.type === "SESSION_STARTED") {
        // Store selected member in sessionStorage for the voting page
        if (selectedMember) {
          sessionStorage.setItem(`agakpoints_member_${session.id}`, JSON.stringify(selectedMember));
        }
        router.push(`/session/${session.id}`);
      }
    },
  });

  const handleCheckin = async (member: Member) => {
    if (checkingIn) return;
    setCheckingIn(true);
    setSelectedMember(member);
    try {
      await fetch(`/api/sessions/${session.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      ws.send(JSON.stringify({
        type: "CHECKIN",
        memberId: member.id,
        memberName: member.name,
      } satisfies PartyClientMessage));
      sessionStorage.setItem(`agakpoints_member_${session.id}`, JSON.stringify(member));
    } finally {
      setCheckingIn(false);
    }
  };

  const isCheckedIn = (memberId: string) => checkedIn.some((c) => c.memberId === memberId);
  const amICheckedIn = selectedMember && isCheckedIn(selectedMember.id);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🃏</div>
          <h1 className="text-2xl font-bold text-white">{session.product.name}</h1>
          <p className="text-white/40 text-sm mt-1">{session.sprintName}</p>
        </div>

        {amICheckedIn ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-8 rounded-2xl border border-emerald-500/30 bg-emerald-600/10"
          >
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-white font-bold text-lg">You&apos;re checked in!</h2>
            <p className="text-white/50 text-sm mt-2">
              Hi {selectedMember.name}! Waiting for the session to start...
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        ) : (
          <div>
            <p className="text-white/60 text-sm text-center mb-6">
              Click your name to check in
            </p>
            <div className="space-y-2">
              <AnimatePresence>
                {session.product.members.map((member) => {
                  const inRoom = isCheckedIn(member.id);
                  return (
                    <motion.button
                      key={member.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => !inRoom && handleCheckin(member)}
                      disabled={inRoom || checkingIn}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        inRoom
                          ? "border-emerald-500/40 bg-emerald-600/10 cursor-not-allowed"
                          : "border-white/10 hover:border-violet-400 hover:bg-violet-600/10 cursor-pointer"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        inRoom ? "bg-emerald-600/30 text-emerald-400" : "bg-white/10 text-white"
                      }`}>
                        {member.name[0]?.toUpperCase()}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-medium ${inRoom ? "text-emerald-300" : "text-white"}`}>
                          {member.name}
                        </p>
                        <p className="text-xs text-white/30">{member.role}</p>
                      </div>
                      {inRoom && <span className="text-emerald-400 text-sm">✓ Checked in</span>}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {checkedIn.length > 0 && (
          <p className="text-center text-white/30 text-xs mt-6">
            {checkedIn.length} of {session.product.members.length} members checked in
          </p>
        )}
      </div>
    </div>
  );
}
