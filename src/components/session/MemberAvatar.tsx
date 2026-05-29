import { getRoleColor } from "@/lib/roles";

interface MemberAvatarProps {
  name: string;
  role: string;
  avatarUrl?: string | null;
  size?: number;
  showRing?: boolean;
  dimmed?: boolean;
}

export function MemberAvatar({ name, role, avatarUrl, size = 36, showRing = false, dimmed = false }: MemberAvatarProps) {
  const { hex } = getRoleColor(role);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold text-white shrink-0 overflow-hidden transition-opacity ${dimmed ? "opacity-40" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.35,
        backgroundColor: hex + "33",
        border: `2px solid ${showRing ? hex : hex + "55"}`,
        boxShadow: showRing ? `0 0 0 2px ${hex}44` : undefined,
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: hex }}>{initials}</span>
      )}
    </div>
  );
}
