"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePartyRoom } from "@/hooks/usePartyRoom";
import type { MsgOut, CheckedInMember } from "@/types/partykit";
import type { Member, PokerSession, Product, SessionParticipant } from "@/types/models";
import { Check, Layers } from "lucide-react";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";

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
  const [liveActive, setLiveActive] = useState(session.status === "ACTIVE");
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    const memberId = stored ? (() => { try { return JSON.parse(stored).id; } catch { return null; } })() : null;
    const url = memberId ? `/api/sessions/${session.id}/member-streaks?memberId=${memberId}` : `/api/sessions/${session.id}/member-streaks`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { streaks: Record<string, number> }) => setStreaks(d.streaks ?? {}))
      .catch(() => {});
  }, [session.id]);

  // Restore selected member from storage; redirect immediately if session is already active
  useEffect(() => {
    const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
    if (stored) {
      try {
        setSelectedMember(JSON.parse(stored));
        // Session was active when page loaded (SSR) — no need to wait for PartyKit
        if (session.status === "ACTIVE") {
          router.push(`/session/${session.id}`);
        }
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { send } = usePartyRoom(session.id, (msg: MsgOut) => {
    if (msg.type === "PRESENCE_UPDATE") setCheckedIn(msg.checkedIn);
    if (msg.type === "STATE_SYNC") {
      setCheckedIn(msg.state.checkedIn);
      if (msg.state.sessionStatus === "ACTIVE") {
        setLiveActive(true);
        const stored = sessionStorage.getItem(`agakpoints_member_${session.id}`);
        if (stored) { router.push(`/session/${session.id}`); return; }
      }
    }
    if (msg.type === "SESSION_STARTED") {
      setLiveActive(true);
      router.push(`/session/${session.id}`);
    }
  });

  const checkin = async (member: Member) => {
    if (busy || isIn(member.id)) return;
    setBusy(true);
    setSelectedMember(member);
    sessionStorage.setItem(`agakpoints_member_${session.id}`, JSON.stringify(member));
    await fetch(`/api/sessions/${session.id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    send({ type: "CHECKIN", memberId: member.id, memberName: member.name, role: member.role });
    setBusy(false);
    // Redirect if session is active (DB or live PartyKit state)
    if (liveActive) {
      router.push(`/session/${session.id}`);
    }
  };

  const isIn = (id: string) => checkedIn.some((c) => c.memberId === id);
  const amCheckedIn = selectedMember && isIn(selectedMember.id);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{session.product.name}</h1>
          <p className="text-white/40 text-sm mt-1">{session.sprintName}</p>
        </div>

        {amCheckedIn ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-8 rounded-2xl border border-emerald-500/30 bg-emerald-600/10"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
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
            <div className="grid grid-cols-2 gap-2">
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
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        inRoom
                          ? "border-emerald-500/40 bg-emerald-600/10 cursor-default"
                          : "border-white/10 hover:border-violet-500 hover:bg-violet-600/10 cursor-pointer active:scale-[0.98]"
                      }`}
                    >
                      <MemberAvatar name={member.name} role={member.role} size={36} showRing={inRoom} dimmed={false} />
                      <div className="text-left flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`font-medium truncate text-sm ${inRoom ? "text-emerald-300" : "text-white"}`}>{member.name}</p>
                          <RoleBadge role={member.role} size="sm" />
                          {(streaks[member.id] ?? 0) >= 5 && (
                            <span className="text-xs font-bold text-orange-400">🔥🔥{streaks[member.id]}</span>
                          )}
                          {(streaks[member.id] ?? 0) >= 2 && (streaks[member.id] ?? 0) < 5 && (
                            <span className="text-xs font-bold text-amber-400">🔥{streaks[member.id]}</span>
                          )}
                        </div>
                        {inRoom && (() => {
                          const p = session.participants.find((x) => x.member.id === member.id);
                          return p ? <p className="text-[10px] text-emerald-400/60 mt-0.5">Checked in {new Date(p.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p> : null;
                        })()}
                      </div>
                      {inRoom && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
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
