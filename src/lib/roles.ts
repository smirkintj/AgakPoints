import type { MemberRole } from "@/types/models";

export const ROLE_COLORS: Record<MemberRole, { hex: string; label: string }> = {
  DEV:       { hex: "#3b82f6", label: "DEV"   },
  QA:        { hex: "#ec4899", label: "QA"    },
  TECH_LEAD: { hex: "#8b5cf6", label: "TL"    },
  SM:        { hex: "#10b981", label: "SM"    },
  UI_UX:     { hex: "#f59e0b", label: "UI/UX" },
};

export function getRoleColor(role: string): { hex: string; label: string } {
  return ROLE_COLORS[role as MemberRole] ?? { hex: "#6b7280", label: role };
}
