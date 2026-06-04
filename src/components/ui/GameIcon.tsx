import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

function svgProps(color: string, size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style: { filter: `drop-shadow(0 0 4px ${color})` },
  };
}

export function FireIcon({ size = 20, className }: IconProps) {
  const c = "#fb923c";
  return (
    <svg {...svgProps(c, size, className)}>
      <path d="M12 22c-3.3 0-6-2.5-6-5.8 0-2.5 1.6-4.6 2.6-6.2.9-1.4 1.4-3 1.4-4.5 1.6.8 3 2.3 3.6 4 .8-.7 1.2-1.7 1.2-2.8 1.6 1.5 3.2 3.9 3.2 6.7C18 19.2 15.3 22 12 22Z" />
      <path d="M12 22c-1.6 0-3-1.3-3-3 0-1.4 1-2.4 1.6-3.3.5.8 1.4 1.3 1.4 2.3.6-.4.9-1 1-1.6.8.8 1.5 1.7 1.5 2.6 0 1.7-1.4 3-2.5 3Z" />
    </svg>
  );
}

export function TargetIcon({ size = 20, className }: IconProps) {
  const c = "#a78bfa";
  return (
    <svg {...svgProps(c, size, className)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill={c} />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function SpicyIcon({ size = 20, className }: IconProps) {
  const c = "#f87171";
  return (
    <svg {...svgProps(c, size, className)}>
      <polyline points="13,2 4.5,13.5 10.5,13.5 11,22 19.5,10.5 13.5,10.5 13,2" />
    </svg>
  );
}

export function ThinkIcon({ size = 20, className }: IconProps) {
  const c = "#38bdf8";
  return (
    <svg {...svgProps(c, size, className)}>
      <circle cx="12" cy="10" r="5" />
      <path d="M10 15v2.5a2 2 0 0 0 4 0V15" />
      <line x1="10" y1="18" x2="14" y2="18" />
      <line x1="10.5" y1="20" x2="13.5" y2="20" />
    </svg>
  );
}

export function ThumbsUpIcon({ size = 20, className }: IconProps) {
  const c = "#34d399";
  return (
    <svg {...svgProps(c, size, className)}>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

export function SkullIcon({ size = 20, className }: IconProps) {
  const c = "#9ca3af";
  return (
    <svg {...svgProps(c, size, className)}>
      <path d="M5 11a7 7 0 0 1 14 0v3a2 2 0 0 1-1 1.7V18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2.3A2 2 0 0 1 5 14z" />
      <circle cx="9" cy="11" r="1.4" fill={c} />
      <circle cx="15" cy="11" r="1.4" fill={c} />
      <line x1="10" y1="19" x2="10" y2="16" />
      <line x1="12" y1="19" x2="12" y2="16" />
      <line x1="14" y1="19" x2="14" y2="16" />
    </svg>
  );
}

export function PartyIcon({ size = 20, className }: IconProps) {
  const c = "#fcd34d";
  return (
    <svg {...svgProps(c, size, className)}>
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="8.5" y2="8.5" />
      <line x1="15.5" y1="15.5" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="15.5" y2="8.5" />
      <line x1="8.5" y1="15.5" x2="5.6" y2="18.4" />
    </svg>
  );
}

export function ShockIcon({ size = 20, className }: IconProps) {
  const c = "#f87171";
  return (
    <svg {...svgProps(c, size, className)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="16" r="0.6" fill={c} />
    </svg>
  );
}

export function BoomIcon({ size = 20, className }: IconProps) {
  const c = "#fb923c";
  return (
    <svg {...svgProps(c, size, className)}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
      <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
      <line x1="7.5" y1="4" x2="16.5" y2="20" />
      <line x1="16.5" y1="4" x2="7.5" y2="20" />
    </svg>
  );
}

export function BeachIcon({ size = 20, className }: IconProps) {
  const c = "#fcd34d";
  return (
    <svg {...svgProps(c, size, className)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M3 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </svg>
  );
}

export function RocketIcon({ size = 20, className }: IconProps) {
  const c = "#a78bfa";
  return (
    <svg {...svgProps(c, size, className)}>
      <path d="M12 2 8 14h8L12 2Z" />
      <path d="M10 16c0 1.5.8 3 2 4 1.2-1 2-2.5 2-4" />
      <path d="M8 12 5 14v3l3-1.5" />
      <path d="M16 12l3 2v3l-3-1.5" />
    </svg>
  );
}

export function PersonIcon({ size = 20, className }: IconProps) {
  const c = "#6b7280";
  return (
    <svg {...svgProps(c, size, className)}>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 20v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}

export function FireBadge({ count, className }: { count: number; className?: string }) {
  if (count < 2) return null;
  const isBright = count >= 5;
  const color = isBright ? "#fb923c" : "#f97316";
  const bgColor = isBright ? "#fb923c22" : "#f9731611";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${className ?? ""}`}
      style={{ background: bgColor, border: `1px solid ${color}55`, color }}
    >
      <FireIcon size={11} />
      {count}
    </span>
  );
}
