"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MemberAvatar } from "./MemberAvatar";
import { RoleBadge } from "./RoleBadge";
import { getRoleColor } from "@/lib/roles";
import { X } from "lucide-react";

interface BandwidthMember {
  memberId: string;
  memberName: string;
  role: string;
  capacity: number;
}

interface EstimatedTicket {
  assigneeId: string | null;
  finalEstimate: number | null;
  status: string;
}

interface BandwidthRailProps {
  members: BandwidthMember[];
  estimatedTickets: EstimatedTicket[];
  pendingAssigneeId?: string | null;
  pendingEstimate?: number | null;
  productId?: string;
  onKick?: (memberId: string) => void;
  sessionLog?: SessionLogEntry[];
}

export interface SessionLogEntry {
  id: string;
  time: Date;
  text: string;
}

function getStateTag(ratio: number) {
  if (ratio < 0.5) return { label: "free", color: "#10b981" };
  if (ratio < 0.8) return { label: "on-track", color: "#3b82f6" };
  if (ratio <= 1.0) return { label: "heavy", color: "#f59e0b" };
  return { label: "over", color: "#ef4444" };
}

function CapacityEditor({
  memberId,
  capacity,
  productId,
  onUpdate,
}: {
  memberId: string;
  capacity: number;
  productId: string;
  onUpdate: (newCapacity: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(capacity));
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      setValue(String(capacity));
      setEditing(false);
      return;
    }
    if (parsed === capacity) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity: parsed }),
      });
      if (res.ok) onUpdate(parsed);
    } catch { /* ignore */ }
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        min={1}
        className="w-10 text-[10px] font-mono bg-white/10 border border-violet-500 rounded px-1 text-white text-center focus:outline-none"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setValue(String(capacity)); setEditing(false); } }}
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => { setValue(String(capacity)); setEditing(true); }}
      title="Click to edit capacity"
      className="text-[10px] font-mono text-white/40 hover:text-violet-300 hover:underline transition-colors"
    >
      /{capacity}pts
    </button>
  );
}

export function BandwidthRail({ members: initialMembers, estimatedTickets, pendingAssigneeId, pendingEstimate, productId, onKick, sessionLog }: BandwidthRailProps) {
  const [capacities, setCapacities] = useState<Record<string, number>>(
    Object.fromEntries(initialMembers.map((m) => [m.memberId, m.capacity]))
  );
  const [logOpen, setLogOpen] = useState(true);

  const members = initialMembers.map((m) => ({ ...m, capacity: capacities[m.memberId] ?? m.capacity }));

  const estimated = estimatedTickets.filter((t) => t.status === "ESTIMATED");

  const loadMap: Record<string, number> = {};
  for (const t of estimated) {
    if (t.assigneeId && t.finalEstimate != null) {
      loadMap[t.assigneeId] = (loadMap[t.assigneeId] ?? 0) + t.finalEstimate;
    }
  }

  const ESTIMATOR_ROLES = ["DEV", "QA"];
  const sorted = [...members].sort((a, b) => (loadMap[b.memberId] ?? 0) - (loadMap[a.memberId] ?? 0));
  const estimators = sorted.filter(m => ESTIMATOR_ROLES.includes(m.role));
  const observers = sorted.filter(m => !ESTIMATOR_ROLES.includes(m.role));
  // Use the max load across estimators only to avoid skew
  const maxLoad = Math.max(...estimators.map((m) => loadMap[m.memberId] ?? 0), 1);

  return (
    <aside className="w-64 shrink-0 border-l border-white/10 bg-white/3 backdrop-blur-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Sprint Bandwidth</p>
      </div>
      <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-3">
        {sorted.length === 0 && (
          <p className="text-xs text-white/30 text-center pt-4">No members checked in</p>
        )}
        <AnimatePresence>
        {estimators.map((m) => {
          const load = loadMap[m.memberId] ?? 0;
          const isPending = pendingAssigneeId === m.memberId && pendingEstimate != null;
          const projectedLoad = isPending ? load + (pendingEstimate ?? 0) : load;
          const { hex } = getRoleColor(m.role);

          return (
            <motion.div key={m.memberId} layout transition={{ type: "spring", stiffness: 300, damping: 30 }} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 group">
                <MemberAvatar name={m.memberName} role={m.role} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/80 font-medium truncate">{m.memberName.split(" ")[0]}</span>
                    <RoleBadge role={m.role} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-white/60 font-semibold">{load}pts</span>
                    {isPending && (
                      <span className="text-[10px] font-mono text-emerald-400">+{pendingEstimate}</span>
                    )}
                  </div>
                </div>
                {onKick && (
                  <button
                    onClick={() => onKick(m.memberId)}
                    title="Kick member (they can re-check-in)"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              {/* Load bar — scaled to estimator max, no artificial cap */}
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(load / maxLoad) * 100}%`, backgroundColor: hex, opacity: 0.7 }}
                />
                {isPending && projectedLoad > load && (
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${(load / maxLoad) * 100}%`,
                      width: `${((projectedLoad - load) / maxLoad) * 100}%`,
                      backgroundColor: "#10b981",
                      opacity: 0.5,
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
        </AnimatePresence>
        {observers.length > 0 && (
          <div className="pt-2 border-t border-white/8 mt-2">
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Also in session</p>
            <div className="flex flex-wrap gap-2">
              {observers.map(m => (
                <div key={m.memberId} className="flex items-center gap-1.5">
                  <MemberAvatar name={m.memberName} role={m.role} size={22} />
                  <span className="text-[10px] text-white/50">{m.memberName.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Session log — collapsible */}
      {sessionLog && sessionLog.length > 0 && (
        <div className="border-t border-white/10 shrink-0 flex flex-col">
          <button
            onClick={() => setLogOpen((o) => !o)}
            className="flex items-center justify-between px-3 py-2 shrink-0 hover:bg-white/3 transition-colors w-full text-left"
          >
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Session Log</p>
            <span className="text-[10px] text-white/20">{logOpen ? "▲" : "▼"} {sessionLog.length}</span>
          </button>
          {logOpen && (
            <div className="overflow-y-auto px-3 pb-2 flex flex-col gap-1.5" style={{ maxHeight: "160px" }}>
              {[...sessionLog].reverse().map((entry) => (
                <div key={entry.id} className="flex items-start gap-1.5">
                  <span className="text-[10px] text-white/20 font-mono shrink-0 mt-0.5">
                    {entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-xs text-white/50 leading-snug">{entry.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
