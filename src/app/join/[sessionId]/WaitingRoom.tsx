"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, CheckedInMember } from "@/types/partykit";
import type { Member, PokerSession, Product, SessionParticipant } from "@/types/models";

type SessionWithDetails = PokerSession & {
  product: Product & { members: Member[] };
  participants: (SessionParticipant & { member: Member })[];
};

export function WaitingRoom({ session }: { session: SessionWithDetails }) {
  const router = useRouter();
  const [checkedIn, setCheckedIn] = useState<CheckedInMember[]>(
    session.participants
      .filter((p) => p.checkedIn)
      .map((p) => ({ memberId: p.member.id, memberName: p.member.name, role: p.member.role }))
  );
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const { send } = usePartyRoom(session.id, (msg: MsgOut) => {
    if (msg.type === "PRESENCE_UPDATE") setCheckedIn(msg.checkedIn);
    if (msg.type === "STATE_SYNC") setCheckedIn(msg.state.checkedIn);
    if (msg.type === "SESSION_STARTED") router.push(`/session/${session.id}`);
  });

  const checkin = async (member: Member) => {
    if (busy || isIn(member.id)) return;
    setBusy(true);
    setSelectedMember(member);
    sessionStorage.setItem(`agakpoints_member_${session.id}`, JSON.stringify(member));
    // DB record
    await fetch(`/api/sessions/${session.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    // Tell the room
    send({ type: "CHECKIN", memberId: member.id, memberName: member.name, role: member.role });
    setBusy(false);
  };

  const isIn = (id: string) => checkedIn.some((c) => c.memberId === id);
  const amCheckedIn = selectedMember && isIn(selectedMember.id);

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

        {amCheckedIn ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-8 rounded-2xl border border-emerald-500/30 bg-emerald-600/10"
          >
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-white font-bold text-lg">You&apos;re in!</h2>
            <p className="text-white/50 text-sm mt-2">Hey {selectedMember.name}, waiting for the host to start...</p>
            <div className="flex justify-center gap-1.5 mt-5">
              {[0, 150, 300].map((d) => (
                <div key={d} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            {/* Show who else is in */}
            {checkedIn.length > 1 && (
              <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
                {checkedIn.filter((c) => c.memberId !== selectedMember.id).map((c) => (
                  <span key={c.memberId} className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/50">
                    {c.memberName}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <div>
            <p className="text-white/60 text-sm text-center mb-5">Click your name to check in</p>
            <div className="space-y-2">
              <AnimatePresence>
                {session.product.members.map((member) => {
                  const inRoom = isIn(member.id);
                  return (
                    <motion.button
                      key={member.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => checkin(member)}
                      disabled={inRoom || busy}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        inRoom
                          ? "border-emerald-500/40 bg-emerald-600/10 cursor-default"
                          : "border-white/10 hover:border-violet-500 hover:bg-violet-600/10 cursor-pointer active:scale-[0.98]"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        inRoom ? "bg-emerald-600/30 text-emerald-400" : "bg-white/10 text-white"
                      }`}>
                        {member.name[0]?.toUpperCase()}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <p className={`font-medium truncate ${inRoom ? "text-emerald-300" : "text-white"}`}>{member.name}</p>
                        <p className="text-xs text-white/30">{member.role}</p>
                      </div>
                      {inRoom && <span className="text-emerald-400 text-sm shrink-0">✓</span>}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-6">
          {checkedIn.length}/{session.product.members.length} checked in
        </p>
      </div>
    </div>
  );
}
