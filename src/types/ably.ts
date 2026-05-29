// All real-time messages published on Ably channels
// Channel name pattern: session:{sessionId}

export type SessionEvent =
  | { type: "PRESENCE_UPDATE"; checkedIn: { memberId: string; memberName: string }[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: { memberId: string; memberName: string; value: number }[] }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "SESSION_COMPLETED" };
