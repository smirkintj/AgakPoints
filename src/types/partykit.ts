// Messages sent client → server
export type MsgIn =
  | { type: "CHECKIN"; memberId: string; memberName: string; role: string }
  | { type: "START_SESSION" }
  | { type: "OPEN_TICKET"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string }
  | { type: "VOTE_CAST"; memberId: string; value: number }
  | { type: "REACTION"; memberId: string; memberName: string; emoji: string }
  | { type: "REVEAL_VOTES" }
  | { type: "LOCK_ESTIMATE"; ticketId: string; value: number; note?: string; assigneeId?: string }
  | { type: "REQUEST_STATE" };

// Messages sent server → client
export type MsgOut =
  | { type: "PRESENCE_UPDATE"; checkedIn: CheckedInMember[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: RevealedVote[]; median: number; isConsensus: boolean }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number; assigneeId?: string }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "STATE_SYNC"; state: PublicState };

export interface CheckedInMember {
  memberId: string;
  memberName: string;
  role: string;
}

export interface RevealedVote {
  memberId: string;
  memberName: string;
  value: number;
}

export interface PublicState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string } | null;
  votedMemberIds: string[];
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
}
