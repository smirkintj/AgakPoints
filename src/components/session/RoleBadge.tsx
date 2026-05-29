import { getRoleColor } from "@/lib/roles";

interface RoleBadgeProps {
  role: string;
  size?: "sm" | "md";
}

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const { hex, label } = getRoleColor(role);
  const padding = size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-xs";
  return (
    <span
      className={`inline-block rounded font-semibold tracking-wider uppercase ${padding}`}
      style={{
        backgroundColor: hex + "22",
        color: hex,
        border: `1px solid ${hex}44`,
      }}
    >
      {label}
    </span>
  );
}
