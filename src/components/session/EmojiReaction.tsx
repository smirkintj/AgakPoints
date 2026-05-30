"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
}

const EMOJIS = ["👍", "🎯", "🤔", "💥", "😱", "🔥", "🎉", "💀"];

let emojiCounter = 0;

export function EmojiReaction({ reactions, onReact, disabled, readOnly }: EmojiReactionProps) {
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
      {/* Floating emojis */}
      <AnimatePresence>
        {floating.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.8 }}
            exit={{}}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute pointer-events-none text-3xl"
            style={{ left: `${e.x}%`, bottom: "100%" }}
          >
            {e.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Reaction buttons — hidden in readOnly mode */}
      {!readOnly && (
        <div className="flex gap-1 flex-wrap">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => !disabled && onReact(emoji)}
              disabled={disabled}
              className="text-xl p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
