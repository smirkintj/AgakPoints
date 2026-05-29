import { BookOpen, Bug, CheckSquare, Zap, GitBranch, HelpCircle } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  Story:      { icon: BookOpen,    color: "#22c55e" },
  Bug:        { icon: Bug,         color: "#ef4444" },
  Task:       { icon: CheckSquare, color: "#3b82f6" },
  Epic:       { icon: Zap,         color: "#8b5cf6" },
  Subtask:    { icon: GitBranch,   color: "#6b7280" },
  "Sub-task": { icon: GitBranch,   color: "#6b7280" },
};

export function TicketTypeIcon({ type, size = 14 }: { type?: string | null; size?: number }) {
  const config = TYPE_CONFIG[type ?? "Story"] ?? { icon: HelpCircle, color: "#6b7280" };
  const Icon = config.icon;
  return <Icon style={{ width: size, height: size, color: config.color }} />;
}
