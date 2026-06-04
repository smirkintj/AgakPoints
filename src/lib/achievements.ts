import { AchievementType } from "@prisma/client";

export function evalOracle(
  votes: { ticketId: string; memberId: string; value: number }[],
  tickets: { id: string; finalEstimate: number | null }[]
): { memberId: string }[] {
  const byTicket = new Map<string, { memberId: string; value: number }[]>();
  for (const v of votes) {
    if (!byTicket.has(v.ticketId)) byTicket.set(v.ticketId, []);
    byTicket.get(v.ticketId)!.push(v);
  }
  const closestCounts = new Map<string, number>();
  for (const t of tickets) {
    if (t.finalEstimate == null) continue;
    const tvotes = byTicket.get(t.id) ?? [];
    if (tvotes.length === 0) continue;
    const minDiff = Math.min(...tvotes.map(v => Math.abs(v.value - t.finalEstimate!)));
    const winners = tvotes.filter(v => Math.abs(v.value - t.finalEstimate!) === minDiff);
    for (const w of winners) {
      closestCounts.set(w.memberId, (closestCounts.get(w.memberId) ?? 0) + 1);
    }
  }
  if (closestCounts.size === 0) return [];
  const maxCount = Math.max(...closestCounts.values());
  return [...closestCounts.entries()].filter(([, c]) => c === maxCount).map(([memberId]) => ({ memberId }));
}

export function evalOptimist(
  votes: { ticketId: string; memberId: string; value: number }[],
  tickets: { id: string; finalEstimate: number | null }[]
): { memberId: string }[] {
  const finalMap = new Map(tickets.filter(t => t.finalEstimate != null).map(t => [t.id, t.finalEstimate!]));
  const memberVotes = new Map<string, { below: number; total: number }>();
  for (const v of votes) {
    const final = finalMap.get(v.ticketId);
    if (final == null) continue;
    const s = memberVotes.get(v.memberId) ?? { below: 0, total: 0 };
    s.total++;
    if (v.value < final) s.below++;
    memberVotes.set(v.memberId, s);
  }
  return [...memberVotes.entries()]
    .filter(([, s]) => s.total >= 3 && s.below / s.total >= 0.7)
    .map(([memberId]) => ({ memberId }));
}

export function evalRealist(
  votes: { ticketId: string; memberId: string; value: number }[],
  tickets: { id: string; finalEstimate: number | null }[]
): { memberId: string }[] {
  const finalMap = new Map(tickets.filter(t => t.finalEstimate != null).map(t => [t.id, t.finalEstimate!]));
  const memberVotes = new Map<string, { above: number; total: number }>();
  for (const v of votes) {
    const final = finalMap.get(v.ticketId);
    if (final == null) continue;
    const s = memberVotes.get(v.memberId) ?? { above: 0, total: 0 };
    s.total++;
    if (v.value > final) s.above++;
    memberVotes.set(v.memberId, s);
  }
  return [...memberVotes.entries()]
    .filter(([, s]) => s.total >= 3 && s.above / s.total >= 0.7)
    .map(([memberId]) => ({ memberId }));
}

export function evalChaosAgent(
  votes: { ticketId: string; memberId: string; value: number }[]
): { memberId: string } | null {
  const memberVotes = new Map<string, number[]>();
  for (const v of votes) {
    if (!memberVotes.has(v.memberId)) memberVotes.set(v.memberId, []);
    memberVotes.get(v.memberId)!.push(v.value);
  }
  let maxSpread = 7;
  let winner: string | null = null;
  for (const [memberId, vals] of memberVotes) {
    if (vals.length < 2) continue;
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread > maxSpread) { maxSpread = spread; winner = memberId; }
  }
  return winner ? { memberId: winner } : null;
}

export function evalLoadBearer(
  assignments: { memberId: string; storyPoints: number }[]
): { memberId: string } | null {
  const totals = new Map<string, number>();
  for (const a of assignments) {
    totals.set(a.memberId, (totals.get(a.memberId) ?? 0) + a.storyPoints);
  }
  if (totals.size === 0) return null;
  const maxSP = Math.max(...totals.values());
  if (maxSP === 0) return null;
  const [memberId] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return { memberId };
}

export function evalPhilosopher(
  votesByTicket: { ticketId: string; votes: { memberId: string; createdAt: Date }[] }[]
): { memberId: string } | null {
  const lastCounts = new Map<string, number>();
  for (const { votes } of votesByTicket) {
    if (votes.length < 2) continue;
    const sorted = [...votes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const last = sorted[0];
    lastCounts.set(last.memberId, (lastCounts.get(last.memberId) ?? 0) + 1);
  }
  if (lastCounts.size === 0) return null;
  const maxCount = Math.max(...lastCounts.values());
  const [memberId] = [...lastCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (maxCount < 2) return null;
  return { memberId };
}

export function evaluateAll(params: {
  tickets: { id: string; finalEstimate: number | null }[];
  votes: { ticketId: string; memberId: string; value: number; createdAt: Date }[];
  participants: { memberId: string }[];
  assignments: { memberId: string; storyPoints: number }[];
}): { memberId: string; type: AchievementType }[] {
  const { tickets, votes, assignments } = params;
  const results: { memberId: string; type: AchievementType }[] = [];

  for (const m of evalOracle(votes, tickets)) results.push({ ...m, type: AchievementType.ORACLE });
  for (const m of evalOptimist(votes, tickets)) results.push({ ...m, type: AchievementType.OPTIMIST });
  for (const m of evalRealist(votes, tickets)) results.push({ ...m, type: AchievementType.REALIST });

  const chaos = evalChaosAgent(votes);
  if (chaos) results.push({ ...chaos, type: AchievementType.CHAOS_AGENT });

  const load = evalLoadBearer(assignments);
  if (load) results.push({ ...load, type: AchievementType.LOAD_BEARER });

  const votesByTicket = tickets.map(t => ({
    ticketId: t.id,
    votes: votes.filter(v => v.ticketId === t.id).map(v => ({ memberId: v.memberId, createdAt: v.createdAt })),
  }));
  const phil = evalPhilosopher(votesByTicket);
  if (phil) results.push({ ...phil, type: AchievementType.PHILOSOPHER });

  const seen = new Set<string>();
  return results.filter(r => {
    const key = `${r.memberId}:${r.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
