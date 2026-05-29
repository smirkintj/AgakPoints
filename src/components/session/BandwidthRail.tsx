"use client";
import { MemberAvatar } from "./MemberAvatar";
import { RoleBadge } from "./RoleBadge";
import { getRoleColor } from "@/lib/roles";

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
}

function getStateTag(ratio: number) {
  if (ratio < 0.5) return { label: "free", color: "#10b981" };
  if (ratio < 0.8) return { label: "on-track", color: "#3b82f6" };
  if (ratio <= 1.0) return { label: "heavy", color: "#f59e0b" };
  return { label: "over", color: "#ef4444" };
}

export function BandwidthRail({ members, estimatedTickets, pendingAssigneeId, pendingEstimate }: BandwidthRailProps) {
  const estimated = estimatedTickets.filter((t) => t.status === "ESTIMATED");

  const loadMap: Record<string, number> = {};
  for (const t of estimated) {
    if (t.assigneeId && t.finalEstimate != null) {
      loadMap[t.assigneeId] = (loadMap[t.assigneeId] ?? 0) + t.finalEstimate;
    }
  }

  const sorted = [...members].sort((a, b) => (loadMap[a.memberId] ?? 0) - (loadMap[b.memberId] ?? 0));

  return (
    <aside className="w-64 shrink-0 border-l border-white/10 bg-white/3 backdrop-blur-sm flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/10 shrink-0">
        <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Sprint Bandwidth</p>
      </div>
      <div className="overflow-y-auto flex-1 p-3 flex flex-col gap-3">
        {sorted.length === 0 && (
          <p className="text-xs text-white/30 text-center pt-4">No members checked in</p>
        )}
        {sorted.map((m) => {
          const load = loadMap[m.memberId] ?? 0;
          const isPending = pendingAssigneeId === m.memberId && pendingEstimate != null;
          const projectedLoad = isPending ? load + (pendingEstimate ?? 0) : load;
          const ratio = load / m.capacity;
          const projectedRatio = projectedLoad / m.capacity;
          const { hex } = getRoleColor(m.role);
          const { label, color } = getStateTag(ratio);

          return (
            <div key={m.memberId} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <MemberAvatar name={m.memberName} role={m.role} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/80 font-medium truncate">{m.memberName.split(" ")[0]}</span>
                    <RoleBadge role={m.role} size="sm" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono text-white/40">{load}/{m.capacity}pts</span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wide px-1 rounded"
                      style={{ color, backgroundColor: color + "22" }}
                    >
                      {label}
                    </span>
                    {isPending && (
                      <span className="text-[10px] font-mono text-emerald-400">+{pendingEstimate}</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Capacity bar */}
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(ratio * 100, 100)}%`,
                    backgroundColor: hex,
                    opacity: 0.7,
                  }}
                />
                {isPending && projectedRatio > ratio && (
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${Math.min(ratio * 100, 100)}%`,
                      width: `${Math.min((projectedRatio - ratio) * 100, 100 - ratio * 100)}%`,
                      backgroundColor: "#10b981",
                      opacity: 0.5,
                    }}
                  />
                )}
                {/* 100% tick */}
                <div className="absolute top-0 right-0 w-px h-full bg-white/30" />
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
