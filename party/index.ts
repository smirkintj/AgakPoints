import type * as Party from "partykit/server";

// ── Types ────────────────────────────────────────────────────────────────────

type MsgIn =
  | { type: "CHECKIN"; memberId: string; memberName: string; role: string }
  | { type: "START_SESSION" }
  | { type: "OPEN_TICKET"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string }
  | { type: "VOTE_CAST"; memberId: string; value: number }
  | { type: "REACTION"; memberId: string; memberName: string; emoji: string }
  | { type: "REVEAL_VOTES" }
  | { type: "LOCK_ESTIMATE"; ticketId: string; value: number; note?: string; assigneeId?: string }
  | { type: "REQUEST_STATE" };

type MsgOut =
  | { type: "PRESENCE_UPDATE"; checkedIn: CheckedInMember[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: RevealedVote[]; median: number; isConsensus: boolean }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number; assigneeId?: string }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "STATE_SYNC"; state: PublicState };

interface CheckedInMember {
  memberId: string;
  memberName: string;
  role: string;
}

interface RevealedVote {
  memberId: string;
  memberName: string;
  value: number;
}

interface PublicState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string } | null;
  votedMemberIds: string[];
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
}

// ── Room state (held in memory per session) ──────────────────────────────────

interface RoomState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string } | null;
  votes: Record<string, number>; // memberId → value (hidden until reveal)
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function isConsensus(values: number[]): boolean {
  return values.length > 0 && new Set(values).size === 1;
}

// ── Partykit Server ──────────────────────────────────────────────────────────

export default class ScrumPokerRoom implements Party.Server {
  private state: RoomState = {
    sessionStatus: "WAITING",
    checkedIn: [],
    currentTicket: null,
    votes: {},
    revealed: false,
    revealedVotes: null,
    lockedTickets: [],
    lockedTicketAssignees: {},
  };

  constructor(readonly room: Party.Room) {}

  // Send current state to a newly connected client so they sync up immediately
  onConnect(conn: Party.Connection) {
    this.send(conn, { type: "STATE_SYNC", state: this.publicState() });
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: MsgIn;
    try {
      msg = JSON.parse(raw) as MsgIn;
    } catch {
      return;
    }

    switch (msg.type) {
      case "CHECKIN": {
        const already = this.state.checkedIn.find((m) => m.memberId === msg.memberId);
        if (!already) {
          this.state.checkedIn.push({
            memberId: msg.memberId,
            memberName: msg.memberName,
            role: msg.role,
          });
        }
        this.broadcast({ type: "PRESENCE_UPDATE", checkedIn: this.state.checkedIn });
        break;
      }

      case "START_SESSION": {
        this.state.sessionStatus = "ACTIVE";
        this.broadcast({ type: "SESSION_STARTED" });
        break;
      }

      case "OPEN_TICKET": {
        // Reset votes for new ticket
        this.state.currentTicket = {
          ticketId: msg.ticketId,
          jiraKey: msg.jiraKey,
          title: msg.title,
          description: msg.description,
          contextNote: msg.contextNote,
          issueType: msg.issueType,
          priority: msg.priority,
        };
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;

        this.broadcast({
          type: "TICKET_OPENED",
          ticketId: msg.ticketId,
          jiraKey: msg.jiraKey,
          title: msg.title,
          description: msg.description,
          contextNote: msg.contextNote,
          issueType: msg.issueType,
          priority: msg.priority,
        });
        break;
      }

      case "VOTE_CAST": {
        if (this.state.revealed) break; // too late
        this.state.votes[msg.memberId] = msg.value;

        this.broadcast({
          type: "VOTE_PROGRESS",
          votedCount: Object.keys(this.state.votes).length,
          totalCount: this.state.checkedIn.length,
          votedMemberIds: Object.keys(this.state.votes),
        });
        break;
      }

      case "REVEAL_VOTES": {
        this.state.revealed = true;
        const memberMap = Object.fromEntries(
          this.state.checkedIn.map((m) => [m.memberId, m.memberName])
        );
        this.state.revealedVotes = Object.entries(this.state.votes).map(
          ([memberId, value]) => ({
            memberId,
            memberName: memberMap[memberId] ?? "Unknown",
            value,
          })
        );

        const values = this.state.revealedVotes.map((v) => v.value);
        this.broadcast({
          type: "VOTES_REVEALED",
          votes: this.state.revealedVotes,
          median: median(values),
          isConsensus: isConsensus(values),
        });
        break;
      }

      case "LOCK_ESTIMATE": {
        this.state.lockedTickets.push(msg.ticketId);
        if (msg.assigneeId) this.state.lockedTicketAssignees[msg.ticketId] = msg.assigneeId;
        this.state.currentTicket = null;
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;

        this.broadcast({ type: "ESTIMATE_LOCKED", ticketId: msg.ticketId, value: msg.value, assigneeId: msg.assigneeId });
        break;
      }

      case "REACTION": {
        this.broadcast({
          type: "REACTION_RECEIVED",
          memberId: msg.memberId,
          memberName: msg.memberName,
          emoji: msg.emoji,
        });
        break;
      }

      case "REQUEST_STATE": {
        this.send(sender, { type: "STATE_SYNC", state: this.publicState() });
        break;
      }
    }
  }

  // Reconnecting clients get current state automatically on connect
  private publicState(): PublicState {
    return {
      sessionStatus: this.state.sessionStatus,
      checkedIn: this.state.checkedIn,
      currentTicket: this.state.currentTicket,
      votedMemberIds: Object.keys(this.state.votes),
      revealed: this.state.revealed,
      revealedVotes: this.state.revealedVotes,
      lockedTickets: this.state.lockedTickets,
      lockedTicketAssignees: this.state.lockedTicketAssignees,
    };
  }

  private broadcast(msg: MsgOut) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private send(conn: Party.Connection, msg: MsgOut) {
    conn.send(JSON.stringify(msg));
  }
}

ScrumPokerRoom satisfies Party.Worker;
