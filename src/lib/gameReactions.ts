export function getAutoReaction(votes: number[]): { emoji: string; label: string } | null {
  if (votes.length < 2) return null;
  const sorted = [...votes].sort((a, b) => a - b);
  const min = sorted[0], max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  if (new Set(votes).size === 1) return { emoji: "🎯", label: "Unanimous!" };
  if (max - min >= 8) return { emoji: "🌶️", label: "Spicy spread!" };
  const outliers = votes.filter(v => Math.abs(v - median) >= 5);
  if (outliers.length === 1) return { emoji: "🤔", label: "One outlier" };
  return null;
}
