"use client";
import { motion } from "framer-motion";
import { cn, calcMedian, getVoteColor } from "@/lib/utils";
import { RoleBadge } from "./RoleBadge";
import { getRoleColor } from "@/lib/roles";

interface RevealCardProps {
  memberName: string;
  value: number;
  median: number;
  delay?: number;
  role?: string;
}

export function RevealCard({ memberName, value, median, delay = 0, role }: RevealCardProps) {
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
      {isOutlier && <span className="text-xs">🌶️</span>}
    </motion.div>
  );
}

export { calcMedian };
