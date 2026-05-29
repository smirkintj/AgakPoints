import { BookOpen, Bug, CheckSquare, Zap, GitBranch, FlaskConical, Wrench, RefreshCw, Sparkles, Circle } from "lucide-react";

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  Story:             { icon: BookOpen,     color: "#22c55e" },
  Bug:               { icon: Bug,          color: "#ef4444" },
  Task:              { icon: CheckSquare,  color: "#3b82f6" },
  Epic:              { icon: Zap,          color: "#8b5cf6" },
  Subtask:           { icon: GitBranch,    color: "#6b7280" },
  "Sub-task":        { icon: GitBranch,    color: "#6b7280" },
  Spike:             { icon: FlaskConical, color: "#f97316" },
  "Technical Debt":  { icon: Wrench,       color: "#eab308" },
  "Tech Debt":       { icon: Wrench,       color: "#eab308" },
  Improvement:       { icon: Wrench,       color: "#eab308" },
  "Change Request":  { icon: RefreshCw,    color: "#06b6d4" },
  "New Feature":     { icon: Sparkles,     color: "#8b5cf6" },
};

export function TicketTypeIcon({ type, size = 14 }: { type?: string | null; size?: number }) {
  const config = TYPE_CONFIG[type ?? "Story"] ?? { icon: Circle, color: "#6b7280" };
  const Icon = config.icon;
  return <Icon style={{ width: size, height: size, color: config.color }} />;
}
