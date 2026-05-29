"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface VotingCardProps {
  value: number;
  selected: boolean;
  disabled: boolean;
  onSelect: (value: number) => void;
}

export function VotingCard({ value, selected, disabled, onSelect }: VotingCardProps) {
  return (
    <motion.button
      whileHover={!disabled && !selected ? { y: -8, scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={selected ? { y: -16, scale: 1.1 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onClick={() => !disabled && onSelect(value)}
      className={cn(
        "relative w-16 h-24 rounded-xl border-2 font-bold text-2xl transition-colors",
        selected
          ? "border-violet-400 bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]"
          : disabled
          ? "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
          : "border-white/20 bg-white/5 text-white hover:border-violet-400 hover:bg-violet-600/20 cursor-pointer"
      )}
    >
      {value}
    </motion.button>
  );
}
