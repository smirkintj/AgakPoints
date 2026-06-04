"use client";
import React, { useState, useEffect } from "react";
import type { AchievementType } from "@prisma/client";

type BadgeStyle = {
  name: string;
  flavour: string;
  color: string;
  glow: string;
  bg: string;
  border: string;
  anim: string;
  iconStroke: string;
  iconFilter: string;
  description: string;
  trigger: string;
};

// Exported config consumed by overlay components.
export const BADGE_CONFIG: Record<AchievementType, BadgeStyle> = {
  ORACLE: {
    name: "Oracle",
    flavour: "Eerily accurate",
    color: "#a78bfa",
    glow: "#7c3aed",
    bg: "radial-gradient(circle at 40% 40%, #4c1d95cc, #2e1065ee)",
    border: "#7c3aedaa",
    anim: "pulse-oracle 2.4s ease-in-out infinite",
    iconStroke: "#c4b5fd",
    iconFilter: "drop-shadow(0 0 4px #a78bfa)",
    description: "Voted closest to the final estimate more than anyone else.",
    trigger: "Closest vote on the most tickets",
  },
  OPTIMIST: {
    name: "Optimist",
    flavour: "How hard can it be?",
    color: "#fcd34d",
    glow: "#d97706",
    bg: "radial-gradient(circle at 40% 40%, #78350fcc, #451a03ee)",
    border: "#d97706aa",
    anim: "pulse-optimist 2.2s ease-in-out infinite",
    iconStroke: "#fde68a",
    iconFilter: "drop-shadow(0 0 4px #fbbf24)",
    description: "Consistently voted below the final estimate. Sees the bright side.",
    trigger: "Under-estimated on 70%+ of tickets",
  },
  REALIST: {
    name: "Realist",
    flavour: "I've seen this before",
    color: "#7dd3fc",
    glow: "#0284c7",
    bg: "radial-gradient(circle at 40% 40%, #0c4a6ecc, #082f49ee)",
    border: "#0284c7aa",
    anim: "pulse-realist 2.6s ease-in-out infinite",
    iconStroke: "#7dd3fc",
    iconFilter: "drop-shadow(0 0 4px #38bdf8)",
    description: "Consistently saw the complexity coming before everyone else did.",
    trigger: "Over-estimated on 70%+ of tickets",
  },
  CHAOS_AGENT: {
    name: "Chaos Agent",
    flavour: "No two tickets alike",
    color: "#fca5a5",
    glow: "#dc2626",
    bg: "radial-gradient(circle at 40% 40%, #7f1d1dcc, #450a0aee)",
    border: "#dc2626aa",
    anim: "pulse-chaos 1.8s ease-in-out infinite",
    iconStroke: "#fca5a5",
    iconFilter: "drop-shadow(0 0 4px #f87171)",
    description: "Biggest spread between lowest and highest vote across the session.",
    trigger: "Widest personal vote range this session",
  },
  LOAD_BEARER: {
    name: "Load Bearer",
    flavour: "Just put it on my plate",
    color: "#6ee7b7",
    glow: "#059669",
    bg: "radial-gradient(circle at 40% 40%, #064e3bcc, #022c22ee)",
    border: "#059669aa",
    anim: "pulse-load 2.4s ease-in-out infinite",
    iconStroke: "#6ee7b7",
    iconFilter: "drop-shadow(0 0 4px #34d399)",
    description: "Carried the most story points this session.",
    trigger: "Most SP assigned at session end",
  },
  PHILOSOPHER: {
    name: "Philosopher",
    flavour: "Let me think about this…",
    color: "#fdba74",
    glow: "#c2410c",
    bg: "radial-gradient(circle at 40% 40%, #7c2d12cc, #431407ee)",
    border: "#c2410caa",
    anim: "pulse-phil 3s ease-in-out infinite",
    iconStroke: "#fdba74",
    iconFilter: "drop-shadow(0 0 4px #fb923c)",
    description: "Always last to submit a vote. Takes time to think it through.",
    trigger: "Last to vote most often this session",
  },
};

const KEYFRAMES = `
@keyframes pulse-oracle   { 0%,100%{box-shadow:0 0 12px 3px #7c3aed55,0 0 28px 6px #7c3aed22} 50%{box-shadow:0 0 20px 6px #7c3aed88,0 0 40px 12px #7c3aed44} }
@keyframes pulse-optimist { 0%,100%{box-shadow:0 0 12px 3px #d9770655,0 0 28px 6px #d9770622} 50%{box-shadow:0 0 20px 6px #d9770688,0 0 40px 12px #d9770644} }
@keyframes pulse-realist  { 0%,100%{box-shadow:0 0 12px 3px #0284c755,0 0 28px 6px #0284c722} 50%{box-shadow:0 0 20px 6px #0284c788,0 0 40px 12px #0284c744} }
@keyframes pulse-chaos    { 0%,100%{box-shadow:0 0 12px 3px #dc262655,0 0 28px 6px #dc262622} 50%{box-shadow:0 0 20px 6px #dc262688,0 0 40px 12px #dc262644} }
@keyframes pulse-load     { 0%,100%{box-shadow:0 0 12px 3px #05966955,0 0 28px 6px #05966922} 50%{box-shadow:0 0 20px 6px #05966988,0 0 40px 12px #05966944} }
@keyframes pulse-phil     { 0%,100%{box-shadow:0 0 12px 3px #c2410c55,0 0 28px 6px #c2410c22} 50%{box-shadow:0 0 20px 6px #c2410c88,0 0 40px 12px #c2410c44} }
@keyframes spin-slow      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes chaos-shake    { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(-8deg)} 40%{transform:rotate(8deg)} 60%{transform:rotate(-5deg)} 80%{transform:rotate(5deg)} }
@keyframes badge-float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
@keyframes tooltip-in     { from{opacity:0;transform:translateY(6px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes shimmer        { 0%{background-position:200% center} 100%{background-position:-200% center} }
`;

const SIZE_MAP = { sm: 24, md: 32, lg: 44, xl: 64 } as const;
const ICON_MAP = { sm: 12, md: 16, lg: 22, xl: 30 } as const;

type Size = keyof typeof SIZE_MAP;

function svgProps(cfg: BadgeStyle, size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: cfg.iconStroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { filter: cfg.iconFilter },
  };
}

function BadgeIcon({ type, size }: { type: AchievementType; size: number }) {
  const cfg = BADGE_CONFIG[type];
  const p = svgProps(cfg, size);
  switch (type) {
    case "ORACLE":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21" />
          <line x1="3" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21" y2="12" />
        </svg>
      );
    case "OPTIMIST":
      return (
        <div style={{ animation: "spin-slow 8s linear infinite", display: "inline-flex" }}>
          <svg {...p}>
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
            <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
          </svg>
        </div>
      );
    case "REALIST":
      return (
        <svg {...p}>
          <path d="M12 2L3 7v6c0 5 4 9 9 10 5-1 9-5 9-10V7L12 2z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case "CHAOS_AGENT":
      return (
        <div style={{ animation: "chaos-shake 1.8s ease-in-out infinite", display: "inline-flex" }}>
          <svg {...p}>
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
      );
    case "LOAD_BEARER":
      return (
        <svg {...p}>
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <rect x="2" y="10" width="4" height="4" rx="1" />
          <rect x="18" y="10" width="4" height="4" rx="1" />
        </svg>
      );
    case "PHILOSOPHER":
      return (
        <div style={{ animation: "badge-float 3s ease-in-out infinite", display: "inline-flex" }}>
          <svg {...p}>
            <path d="M12 2a7 7 0 0 1 7 7c0 3.5-2.5 5.5-3 8H8c-.5-2.5-3-4.5-3-8a7 7 0 0 1 7-7z" />
            <line x1="9" y1="21" x2="15" y2="21" />
            <line x1="10" y1="17" x2="14" y2="17" />
          </svg>
        </div>
      );
    default:
      return null;
  }
}

interface AchievementBadgeProps {
  type: AchievementType;
  size?: Size;
  showTooltip?: boolean;
}

export function AchievementBadge({ type, size = "md", showTooltip = false }: AchievementBadgeProps) {
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (document.getElementById("achievement-badge-keyframes")) return;
    const el = document.createElement("style");
    el.id = "achievement-badge-keyframes";
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, []);
  const cfg = BADGE_CONFIG[type];
  if (!cfg) return null;
  const px = SIZE_MAP[size];
  const iconSize = ICON_MAP[size];

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          background: cfg.bg,
          border: `2px solid ${cfg.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: cfg.anim,
        }}
      >
        <BadgeIcon type={type} size={iconSize} />
      </div>
      {showTooltip && hover && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1535",
            border: "1px solid #7c3aed44",
            borderRadius: 10,
            padding: "9px 13px",
            minWidth: 180,
            maxWidth: 220,
            zIndex: 50,
            boxShadow: "0 8px 32px #00000088, 0 0 0 1px #ffffff08",
            animation: "tooltip-in 0.18s ease-out",
          }}
        >
          <p style={{ color: cfg.color, fontWeight: 700, fontSize: 13 }}>{cfg.name}</p>
          <p style={{ color: "#9d8ec9", fontSize: 12, marginTop: 2 }}>{cfg.description}</p>
          <p style={{ color: "#6b5fa6", fontSize: 11, marginTop: 6, paddingTop: 6, borderTop: "1px solid #ffffff10" }}>{cfg.trigger}</p>
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #1a1535",
            }}
          />
        </div>
      )}
    </div>
  );
}
