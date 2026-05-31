import type * as Party from "partykit/server";

// ── Types ────────────────────────────────────────────────────────────────────

type MsgIn =
  | { type: "CHECKIN"; memberId: string; memberName: string; role: string }
  | { type: "START_SESSION" }
  | { type: "OPEN_TICKET"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string; deps?: string[] }
  | { type: "VOTE_CAST"; memberId: string; value: number }
  | { type: "REACTION"; memberId: string; memberName: string; emoji: string }
  | { type: "REVEAL_VOTES" }
  | { type: "LOCK_ESTIMATE"; ticketId: string; value: number; note?: string; assigneeId?: string }
  | { type: "REQUEST_STATE" }
  | { type: "END_SESSION" }
  | { type: "KICK_MEMBER"; memberId: string }
  | { type: "UPDATE_NOTE"; ticketId: string; note: string }
  | { type: "UPDATE_LEAVE"; memberId: string; date: string; active: boolean }
  | { type: "UPDATE_TICKET_DESIGN"; ticketId: string; designReadiness?: string | null; designComplexity?: string | null; designLink?: string | null }
  | { type: "UPDATE_TICKET_TAGS"; ticketId: string; tags: string[] };

type MsgOut =
  | { type: "PRESENCE_UPDATE"; checkedIn: CheckedInMember[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string; deps?: string[] }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: RevealedVote[]; median: number; isConsensus: boolean }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number; assigneeId?: string }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "STATE_SYNC"; state: PublicState }
  | { type: "SESSION_ENDED" }
  | { type: "MEMBER_KICKED"; memberId: string }
  | { type: "NOTE_UPDATED"; ticketId: string; note: string }
  | { type: "LEAVE_UPDATED"; memberId: string; date: string; active: boolean }
  | { type: "TICKET_DESIGN_UPDATED"; ticketId: string; designReadiness?: string | null; designComplexity?: string | null; designLink?: string | null }
  | { type: "TICKET_TAGS_UPDATED"; ticketId: string; tags: string[] };

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
  serverVersion: string;
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string; deps?: string[] } | null;
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
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; issueType?: string; priority?: string; deps?: string[] } | null;
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
          deps: msg.deps,
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
          deps: msg.deps,
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

      case "UPDATE_LEAVE": {
        this.broadcast({ type: "LEAVE_UPDATED", memberId: msg.memberId, date: msg.date, active: msg.active });
        break;
      }

      case "UPDATE_NOTE": {
        if (this.state.currentTicket?.ticketId === msg.ticketId) {
          this.state.currentTicket.contextNote = msg.note;
        }
        this.broadcast({ type: "NOTE_UPDATED", ticketId: msg.ticketId, note: msg.note });
        break;
      }

      case "END_SESSION": {
        this.broadcast({ type: "SESSION_ENDED" });
        break;
      }

      case "UPDATE_TICKET_DESIGN": {
        this.broadcast({ type: "TICKET_DESIGN_UPDATED", ticketId: msg.ticketId, designReadiness: msg.designReadiness, designComplexity: msg.designComplexity, designLink: msg.designLink });
        break;
      }

      case "UPDATE_TICKET_TAGS": {
        this.broadcast({ type: "TICKET_TAGS_UPDATED", ticketId: msg.ticketId, tags: msg.tags });
        break;
      }

      case "KICK_MEMBER": {
        this.state.checkedIn = this.state.checkedIn.filter((m) => m.memberId !== msg.memberId);
        // Also remove their vote if pending
        delete this.state.votes[msg.memberId];
        this.broadcast({ type: "MEMBER_KICKED", memberId: msg.memberId });
        this.broadcast({ type: "PRESENCE_UPDATE", checkedIn: this.state.checkedIn });
        break;
      }
    }
  }

  // Reconnecting clients get current state automatically on connect
  private publicState(): PublicState {
    return {
      serverVersion: "2026-05-31.2",
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
