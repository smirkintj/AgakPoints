"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MemberAvatar } from "./MemberAvatar";
import { BandwidthRail } from "./BandwidthRail";
import { Button } from "@/components/ui/button";
import type { Member, Ticket } from "@/types/models";
import { X } from "lucide-react";

type TicketRow = Ticket & { assigneeId: string | null };

interface BulkAssignDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  tickets: TicketRow[];
  members: (Member & { capacity: number })[];
  estimatedTickets: { assigneeId: string | null; finalEstimate: number | null; status: string }[];
  onCommit: (assignments: { ticketId: string; memberId: string }[]) => void;
}

export function BulkAssignDrawer({ open, onClose, sessionId, tickets, members, estimatedTickets, onCommit }: BulkAssignDrawerProps) {
  const estimated = tickets.filter((t) => t.status === "ESTIMATED");
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(estimated.filter((t) => t.assigneeId).map((t) => [t.id, t.assigneeId!]))
  );
  const [saving, setSaving] = useState(false);

  const draftTickets = useMemo(() =>
    estimatedTickets.map((t) => ({
      ...t,
      assigneeId: (t as TicketRow).id ? (draftAssignments[(t as TicketRow).id] ?? t.assigneeId) : t.assigneeId,
    })),
    [estimatedTickets, draftAssignments]
  );

  const currentLoadMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of estimatedTickets) {
      if (t.assigneeId && t.finalEstimate != null && t.status === "ESTIMATED") {
        map[t.assigneeId] = (map[t.assigneeId] ?? 0) + t.finalEstimate;
      }
    }
    return map;
  }, [estimatedTickets]);

  const autoBalance = () => {
    const unassigned = estimated.filter((t) => !draftAssignments[t.id]).sort((a, b) => (b.finalEstimate ?? 0) - (a.finalEstimate ?? 0));
    const draftLoad: Record<string, number> = { ...currentLoadMap };
    const newDraft = { ...draftAssignments };

    for (const ticket of unassigned) {
      const lightest = members.reduce((best, m) => {
        const load = draftLoad[m.id] ?? 0;
        const bestLoad = draftLoad[best.id] ?? 0;
        return load < bestLoad ? m : best;
      }, members[0]);
      if (!lightest) continue;
      newDraft[ticket.id] = lightest.id;
      draftLoad[lightest.id] = (draftLoad[lightest.id] ?? 0) + (ticket.finalEstimate ?? 0);
    }
    setDraftAssignments(newDraft);
  };

  const handleCommit = async () => {
    setSaving(true);
    const assignments = Object.entries(draftAssignments).map(([ticketId, memberId]) => ({ ticketId, memberId }));
    await fetch(`/api/sessions/${sessionId}/bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    onCommit(assignments);
    setSaving(false);
    onClose();
  };

  const bandwidthMembers = members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    role: m.role,
    capacity: m.capacity,
  }));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-[820px] max-w-full bg-[#1a1040] border-l border-white/10 z-50 flex flex-col"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-white font-semibold">Bulk Assign</h2>
                <p className="text-xs text-white/40">{estimated.length} estimated tickets</p>
              </div>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Ticket table */}
              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="text-left pb-2 pr-4">Ticket</th>
                      <th className="text-left pb-2 pr-4">Pts</th>
                      <th className="text-left pb-2">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimated.map((ticket) => {
                      const assigneeId = draftAssignments[ticket.id] ?? null;
                      const assignee = assigneeId ? members.find((m) => m.id === assigneeId) : null;
                      return (
                        <tr key={ticket.id} className="border-b border-white/5 group">
                          <td className="py-2 pr-4">
                            <div>
                              <span className="font-mono text-violet-400 text-xs">{ticket.jiraKey}</span>
                              <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{ticket.title}</p>
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <span className="font-mono text-white/60 text-xs">{ticket.finalEstimate ?? "—"}</span>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => {
                                  const next = { ...draftAssignments };
                                  delete next[ticket.id];
                                  setDraftAssignments(next);
                                }}
                                className={`px-2 py-1 rounded text-xs border transition-colors ${
                                  !assigneeId ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-white/30 hover:text-white/60"
                                }`}
                              >
                                None
                              </button>
                              {members.map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setDraftAssignments((d) => ({ ...d, [ticket.id]: m.id }))}
                                  title={m.name}
                                  className="transition-transform hover:scale-110"
                                  style={{
                                    outline: assignee?.id === m.id ? "2px solid #8b5cf6" : "2px solid transparent",
                                    outlineOffset: 2,
                                    borderRadius: "50%",
                                  }}
                                >
                                  <MemberAvatar name={m.name} role={m.role} size={28} showRing={assignee?.id === m.id} />
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bandwidth rail (projected) */}
              <BandwidthRail
                members={bandwidthMembers}
                estimatedTickets={draftTickets as { assigneeId: string | null; finalEstimate: number | null; status: string }[]}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 shrink-0">
              <Button variant="ghost" size="sm" onClick={autoBalance}>
                ⚖️ Auto-balance
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleCommit} disabled={saving}>
                  {saving ? "Saving..." : "Commit → JIRA"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
