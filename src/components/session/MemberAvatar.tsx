import Image from "next/image";
import { getRoleColor } from "@/lib/roles";

interface MemberAvatarProps {
  name: string;
  role: string;
  avatarUrl?: string | null;
  size?: number;
  showRing?: boolean;
  dimmed?: boolean;
  title?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberAvatar({ name, role, avatarUrl, size = 36, showRing = false, dimmed = false, title }: MemberAvatarProps) {
  const { hex } = getRoleColor(role);
  const fontSize = Math.max(9, Math.round(size * 0.38));

  return (
    <div
      title={title}
      className={`rounded-full flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden transition-opacity ${dimmed ? "opacity-40" : ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: hex + "33",
        border: `2px solid ${showRing ? hex : hex + "55"}`,
        boxShadow: showRing ? `0 0 0 2px ${hex}44` : undefined,
        position: "relative",
        fontSize,
        letterSpacing: "-0.02em",
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      ) : (
        <span style={{ color: hex, lineHeight: 1 }}>{getInitials(name)}</span>
      )}
    </div>
  );
}
