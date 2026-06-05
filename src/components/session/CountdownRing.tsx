"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  duration: number;       // seconds
  startedAt: string;      // ISO timestamp
  size?: number;
  onExpire?: () => void;
}

export function CountdownRing({ duration, startedAt, size = 64, onExpire }: Props) {
  const [remaining, setRemaining] = useState<number>(duration);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
      const rem = Math.max(0, duration - elapsed);
      setRemaining(rem);
      if (rem === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [duration, startedAt, onExpire]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / duration;
  const offset = circumference * (1 - progress);

  const color =
    remaining <= 5 ? "#ef4444" :
    remaining <= 10 ? "#f59e0b" :
    "#a78bfa";

  const displaySecs = Math.ceil(remaining);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={4}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.28,
        fontWeight: 700,
        fontFamily: "ui-monospace, monospace",
        color,
      }}>
        {displaySecs > 0 ? displaySecs : "✓"}
      </div>
    </div>
  );
}
