export type PartyClientMessage =
  | { type: "CHECKIN"; memberId: string; memberName: string }
  | { type: "VOTE_CAST"; memberId: string; value: number }
  | { type: "REACTION"; memberId: string; emoji: string }
  | { type: "START_SESSION" }
  | { type: "OPEN_TICKET"; ticketId: string }
  | { type: "REVEAL_VOTES" }
  | { type: "LOCK_ESTIMATE"; ticketId: string; value: number; note?: string }
  | { type: "NEXT_TICKET" };

export type PartyServerMessage =
  | { type: "PRESENCE_UPDATE"; checkedIn: { memberId: string; memberName: string }[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string; jiraKey: string; title: string; description?: string }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: { memberId: string; memberName: string; value: number }[] }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "SESSION_COMPLETED" };

export interface RoomState {
  status: "WAITING" | "ACTIVE" | "COMPLETED";
  currentTicketId: string | null;
  checkedIn: { memberId: string; memberName: string }[];
  votes: Record<string, number>;
  revealed: boolean;
  totalParticipants: number;
}
