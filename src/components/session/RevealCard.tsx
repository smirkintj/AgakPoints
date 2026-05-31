"use client";
import { motion } from "framer-motion";
import { cn, calcMedian, getVoteColor } from "@/lib/utils";
import { RoleBadge } from "./RoleBadge";
import { getRoleColor } from "@/lib/roles";
import { Flame } from "lucide-react";

interface RevealCardProps {
  memberName: string;
  value: number;
  median: number;
  delay?: number;
  role?: string;
  voteHistory?: { vote: number; final: number }[];
}

export function RevealCard({ memberName, value, median, delay = 0, role, voteHistory }: RevealCardProps) {
  const colorClass = getVoteColor(value, median);
  const isOutlier = Math.abs(value - median) >= 5;
  const roleHex = role ? getRoleColor(role).hex : undefined;

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center gap-2"
    >
      <div
        className={cn(
          "w-16 h-24 rounded-xl border-2 flex items-center justify-center font-bold text-2xl",
          isOutlier
            ? "border-orange-400 bg-orange-600/20 text-orange-400 animate-pulse"
            : "border-white/20 bg-white/10 text-white"
        )}
        style={roleHex && !isOutlier ? { borderColor: roleHex + "88", backgroundColor: roleHex + "18" } : undefined}
      >
        <span className={colorClass}>{value}</span>
      </div>
      <span className="text-xs text-white/50 text-center max-w-[64px] truncate">{memberName}</span>
      {role && <RoleBadge role={role} size="sm" />}
      {isOutlier && <Flame className="w-3 h-3 text-orange-400" />}
      {voteHistory && voteHistory.length > 0 && (
        <div className="flex gap-1 mt-1">
          {voteHistory.map((h, i) => {
            const diff = Math.abs(h.vote - h.final);
            const color = diff <= 1 ? "#10b981" : diff <= 3 ? "#f59e0b" : "#ef4444";
            return (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.3 + i * 0.05 }}
                title={`Voted ${h.vote}, final was ${h.final}`}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export { calcMedian };
