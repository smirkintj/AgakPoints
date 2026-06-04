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

export function MemberAvatar({ name, role, avatarUrl, size = 36, showRing = false, dimmed = false, title }: MemberAvatarProps) {
  const { hex } = getRoleColor(role);

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
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} fill className="object-cover" />
      ) : (
        <Image
          src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=transparent`}
          alt={name}
          width={size}
          height={size}
          unoptimized
          style={{ borderRadius: "50%" }}
        />
      )}
    </div>
  );
}
