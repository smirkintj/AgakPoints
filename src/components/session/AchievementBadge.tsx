"use client";
import React, { useState, useEffect } from "react";
import type { AchievementType } from "@prisma/client";
import { TargetIcon, SpicyIcon, ThinkIcon } from "@/components/ui/GameIcon";

interface BadgeIconProps {
  size?: number;
  className?: string;
}

function badgeSvgProps(color: string, size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { filter: `drop-shadow(0 0 4px ${color})` },
  };
}

function SunIcon({ size = 20 }: BadgeIconProps) {
  const c = "#fcd34d";
  const lines = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = 12 + Math.cos(a) * 7;
    const y1 = 12 + Math.sin(a) * 7;
    const x2 = 12 + Math.cos(a) * 10;
    const y2 = 12 + Math.sin(a) * 10;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  return (
    <svg {...badgeSvgProps(c, size)}>
      <circle cx="12" cy="12" r="4" />
      {lines}
    </svg>
  );
}

function ShieldIcon({ size = 20 }: BadgeIconProps) {
  const c = "#7dd3fc";
  return (
    <svg {...badgeSvgProps(c, size)}>
      <path d="M12 2 20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 L12 2 Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function BarbellIcon({ size = 20 }: BadgeIconProps) {
  const c = "#34d399";
  return (
    <svg {...badgeSvgProps(c, size)}>
      <line x1="4" y1="12" x2="20" y2="12" />
      <rect x="4" y="10" width="4" height="4" />
      <rect x="16" y="10" width="4" height="4" />
      <line x1="7" y1="8" x2="7" y2="16" />
      <line x1="17" y1="8" x2="17" y2="16" />
    </svg>
  );
}

type BadgeConfig = {
  Icon: React.ComponentType<BadgeIconProps>;
  color: string;
  glow: string;
  animation: string;
  name: string;
  description: string;
  trigger: string;
};

const CONFIGS: Record<AchievementType, BadgeConfig> = {
  ORACLE: {
    Icon: TargetIcon,
    color: "#a78bfa",
    glow: "#7c3aed",
    animation: "badgePulse 2.4s ease-in-out infinite",
    name: "Oracle",
    description: "Voted closest to the final estimate most often",
    trigger: "Closest vote on the most tickets",
  },
  OPTIMIST: {
    Icon: SunIcon,
    color: "#fcd34d",
    glow: "#d97706",
    animation: "badgeSpin 8s linear infinite",
    name: "Optimist",
    description: "Consistently voted below the final estimate",
    trigger: "Under-estimated on 70%+ of tickets",
  },
  REALIST: {
    Icon: ShieldIcon,
    color: "#7dd3fc",
    glow: "#0284c7",
    animation: "badgePulse 2.6s ease-in-out infinite",
    name: "Realist",
    description: "Consistently saw the complexity coming",
    trigger: "Over-estimated on 70%+ of tickets",
  },
  CHAOS_AGENT: {
    Icon: SpicyIcon,
    color: "#fca5a5",
    glow: "#dc2626",
    animation: "badgeShake 1.8s ease-in-out infinite",
    name: "Chaos Agent",
    description: "Biggest spread between lowest and highest vote",
    trigger: "Widest personal vote range this session",
  },
  LOAD_BEARER: {
    Icon: BarbellIcon,
    color: "#34d399",
    glow: "#059669",
    animation: "badgePulse 2.4s ease-in-out infinite",
    name: "Load Bearer",
    description: "Carried the most story points this session",
    trigger: "Most SP assigned at session end",
  },
  PHILOSOPHER: {
    Icon: ThinkIcon,
    color: "#fdba74",
    glow: "#c2410c",
    animation: "badgeFloat 3s ease-in-out infinite",
    name: "Philosopher",
    description: "Always last to submit a vote",
    trigger: "Last to vote most often this session",
  },
};

const SIZE_MAP = { sm: 24, md: 36, lg: 48 } as const;

const KEYFRAMES = `
@keyframes badgePulse { 0%,100% { box-shadow: 0 0 12px 3px var(--g55), 0 0 28px 6px var(--g22) } 50% { box-shadow: 0 0 18px 6px var(--g88), 0 0 36px 10px var(--g44) } }
@keyframes badgeShake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-8deg)} 40%{transform:rotate(8deg)} 60%{transform:rotate(-5deg)} 80%{transform:rotate(5deg)} }
@keyframes badgeFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes badgeSpin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
`;

interface AchievementBadgeProps {
  type: AchievementType;
  size?: "sm" | "md" | "lg";
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
  const cfg = CONFIGS[type];
  if (!cfg) return null;
  const px = SIZE_MAP[size];
  const iconSize = Math.round(px * 0.55);
  const { glow, color, Icon } = cfg;

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
          background: `radial-gradient(circle at 40% 40%, ${glow}33, ${glow}11)`,
          border: `2px solid ${glow}aa`,
          boxShadow: `0 0 12px 3px ${glow}55, 0 0 28px 6px ${glow}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: cfg.animation,
          ["--g55" as string]: `${glow}55`,
          ["--g22" as string]: `${glow}22`,
          ["--g88" as string]: `${glow}88`,
          ["--g44" as string]: `${glow}44`,
        }}
      >
        <Icon size={iconSize} />
      </div>
      {showTooltip && hover && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0d0b1a",
            border: "1px solid #7c3aed55",
            borderRadius: 10,
            padding: "8px 12px",
            minWidth: 180,
            zIndex: 50,
          }}
        >
          <p style={{ color, fontWeight: 700, fontSize: 13 }}>{cfg.name}</p>
          <p className="text-white/70" style={{ fontSize: 12, marginTop: 2 }}>{cfg.description}</p>
          <p className="text-white/40" style={{ fontSize: 11, marginTop: 4 }}>{cfg.trigger}</p>
        </div>
      )}
    </div>
  );
}
