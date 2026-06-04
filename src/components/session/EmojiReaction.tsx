"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUpIcon, TargetIcon, ThinkIcon, BoomIcon, ShockIcon, FireIcon, PartyIcon, SkullIcon,
} from "@/components/ui/GameIcon";

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

interface EmojiReactionProps {
  reactions: { memberId: string; memberName: string; emoji: string }[];
  onReact: (emoji: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  emojis?: string[];
}

const EMOJIS = ["THUMBS_UP", "TARGET", "THINK", "BOOM", "SHOCK", "FIRE", "PARTY", "SKULL"];

const ICON_MAP: Record<string, (size: number) => React.ReactNode> = {
  THUMBS_UP: (s) => <ThumbsUpIcon size={s} />,
  TARGET: (s) => <TargetIcon size={s} />,
  THINK: (s) => <ThinkIcon size={s} />,
  BOOM: (s) => <BoomIcon size={s} />,
  SHOCK: (s) => <ShockIcon size={s} />,
  FIRE: (s) => <FireIcon size={s} />,
  PARTY: (s) => <PartyIcon size={s} />,
  SKULL: (s) => <SkullIcon size={s} />,
};

function renderIcon(key: string, size: number): React.ReactNode {
  return ICON_MAP[key]?.(size) ?? null;
}

let emojiCounter = 0;

export function EmojiReaction({ reactions, onReact, disabled, readOnly, emojis = EMOJIS }: EmojiReactionProps) {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const last = reactions[reactions.length - 1];
    const id = ++emojiCounter;
    const x = 20 + Math.random() * 60;
    setFloating((f) => [...f, { id, emoji: last.emoji, x }]);
    setTimeout(() => setFloating((f) => f.filter((e) => e.id !== id)), 1600);
  }, [reactions]);

  return (
    <div className="relative">
      {/* Floating icons */}
      <AnimatePresence>
        {floating.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.8 }}
            exit={{}}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute pointer-events-none"
            style={{ left: `${e.x}%`, bottom: "100%" }}
          >
            {renderIcon(e.emoji, 30)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Reaction buttons — hidden in readOnly mode */}
      {!readOnly && (
        <div className="flex gap-1 flex-wrap">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => !disabled && onReact(emoji)}
              disabled={disabled}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {renderIcon(emoji, 20)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
