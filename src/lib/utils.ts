import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FIBONACCI_VALUES = [1, 2, 3, 5, 8, 13, 21];

export function getVoteColor(value: number, median: number): string {
  const diff = Math.abs(value - median);
  if (diff === 0) return "text-green-400";
  if (diff <= 2) return "text-yellow-400";
  return "text-red-400";
}

export function calcMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function isConsensus(values: number[]): boolean {
  return new Set(values).size === 1;
}
