import type * as Party from "partykit/server";

// ── Types ────────────────────────────────────────────────────────────────────

type MsgIn =
  | { type: "CHECKIN"; memberId: string; memberName: string; role: string }
  | { type: "REGISTER_ADMIN"; token: string }
  | { type: "START_SESSION" }
  | { type: "OPEN_TICKET"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; noteForDev?: string; noteForQA?: string; noteForUIUX?: string; issueType?: string; priority?: string; deps?: string[] }
  | { type: "VOTE_CAST"; memberId: string; value: number }
  | { type: "REACTION"; memberId: string; memberName: string; emoji: string }
  | { type: "REVEAL_VOTES" }
  | { type: "LOCK_ESTIMATE"; ticketId: string; value: number; note?: string; assigneeId?: string }
  | { type: "REQUEST_STATE" }
  | { type: "END_SESSION" }
  | { type: "KICK_MEMBER"; memberId: string }
  | { type: "UPDATE_NOTE"; ticketId: string; note: string; noteRole?: "DEV" | "QA" | "UI_UX" }
  | { type: "UPDATE_LEAVE"; memberId: string; date: string; active: boolean }
  | { type: "UPDATE_TICKET_DESIGN"; ticketId: string; designReadiness?: string | null; designComplexity?: string | null; designLink?: string | null }
  | { type: "UPDATE_TICKET_TAGS"; ticketId: string; tags: string[] }
  | { type: "PUSH_CALENDAR" }
  | { type: "SET_TIMER"; duration: number | null }
  | { type: "TICKET_FLAGGED"; ticketId: string; flag: string; active: boolean };

type MsgOut =
  | { type: "PRESENCE_UPDATE"; checkedIn: CheckedInMember[] }
  | { type: "SESSION_STARTED" }
  | { type: "TICKET_OPENED"; ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; noteForDev?: string; noteForQA?: string; noteForUIUX?: string; issueType?: string; priority?: string; deps?: string[]; timerDuration?: number | null; timerStartedAt?: string }
  | { type: "VOTE_PROGRESS"; votedCount: number; totalCount: number; votedMemberIds: string[] }
  | { type: "VOTES_REVEALED"; votes: RevealedVote[]; median: number; isConsensus: boolean }
  | { type: "ESTIMATE_LOCKED"; ticketId: string; value: number; assigneeId?: string }
  | { type: "REACTION_RECEIVED"; memberId: string; memberName: string; emoji: string }
  | { type: "STATE_SYNC"; state: PublicState }
  | { type: "SESSION_ENDED" }
  | { type: "MEMBER_KICKED"; memberId: string }
  | { type: "NOTE_UPDATED"; ticketId: string; note: string; noteRole?: "DEV" | "QA" | "UI_UX" }
  | { type: "LEAVE_UPDATED"; memberId: string; date: string; active: boolean }
  | { type: "TICKET_DESIGN_UPDATED"; ticketId: string; designReadiness?: string | null; designComplexity?: string | null; designLink?: string | null }
  | { type: "TICKET_TAGS_UPDATED"; ticketId: string; tags: string[] }
  | { type: "CALENDAR_UPDATED" }
  | { type: "TIMER_UPDATED"; duration: number | null; startedAt: string | null }
  | { type: "TICKET_FLAGS_UPDATED"; ticketId: string; flags: string[] };

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
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; noteForDev?: string; noteForQA?: string; noteForUIUX?: string; issueType?: string; priority?: string; deps?: string[] } | null;
  votedMemberIds: string[];
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
  timerDuration: number | null;
  timerStartedAt: string | null;
  ticketFlags: Record<string, string[]>;
}

// ── Room state (held in memory per session) ──────────────────────────────────

interface RoomState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: { ticketId: string; jiraKey: string; title: string; description?: string; contextNote?: string; noteForDev?: string; noteForQA?: string; noteForUIUX?: string; issueType?: string; priority?: string; deps?: string[] } | null;
  votes: Record<string, number>;
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
  timerDuration: number | null;
  timerStartedAt: string | null;
  ticketFlags: Record<string, string[]>;
  adminConnectionIds: Set<string>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifyAdminToken(sessionId: string, token: string): Promise<boolean> {
  const secret = process.env.PARTYKIT_SECRET ?? "dev-secret";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sessionId));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return token === expected;
}

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
    timerDuration: 20,
    timerStartedAt: null,
    ticketFlags: {},
    adminConnectionIds: new Set(),
  };

  constructor(readonly room: Party.Room) {}

  async onStart() {
    const stored = await this.room.storage.get<Partial<RoomState>>("state");
    if (stored) {
      this.state = {
        ...this.state,
        ...stored,
        timerDuration: stored.timerDuration !== undefined ? stored.timerDuration : 20,
        ticketFlags: stored.ticketFlags ?? {},
        adminConnectionIds: new Set(),
      };
    }
  }

  private async persist() {
    try {
      const { adminConnectionIds, ...persistable } = this.state;
      await this.room.storage.put("state", persistable);
    } catch (err) {
      console.error("[PartyKit] persist failed:", err);
    }
  }

  private isAdmin(sender: Party.Connection): boolean {
    return this.state.adminConnectionIds.has(sender.id);
  }

  // Send current state to a newly connected client so they sync up immediately
  onConnect(conn: Party.Connection) {
    this.send(conn, { type: "STATE_SYNC", state: this.publicState() });
  }

  onDisconnect(conn: Party.Connection) {
    this.state.adminConnectionIds.delete(conn.id);
  }

  async onMessage(raw: string, sender: Party.Connection) {
    let msg: MsgIn;
    try {
      msg = JSON.parse(raw) as MsgIn;
    } catch {
      return;
    }

    switch (msg.type) {
      case "REGISTER_ADMIN": {
        verifyAdminToken(this.room.id, msg.token).then((valid) => {
          if (valid) {
            this.state.adminConnectionIds.add(sender.id);
          }
        });
        break;
      }

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
        await this.persist();
        break;
      }

      case "START_SESSION": {
        if (!this.isAdmin(sender)) return;
        this.state.sessionStatus = "ACTIVE";
        this.broadcast({ type: "SESSION_STARTED" });
        await this.persist();
        break;
      }

      case "SET_TIMER": {
        if (!this.isAdmin(sender)) return;
        if (msg.duration !== null && (msg.duration < 0 || msg.duration > 300)) return;
        this.state.timerDuration = msg.duration;
        this.state.timerStartedAt = null;
        this.broadcast({ type: "TIMER_UPDATED", duration: this.state.timerDuration, startedAt: null });
        await this.persist();
        break;
      }

      case "OPEN_TICKET": {
        if (!this.isAdmin(sender)) return;
        const timerStartedAt = this.state.timerDuration ? new Date().toISOString() : null;
        this.state.currentTicket = {
          ticketId: msg.ticketId,
          jiraKey: msg.jiraKey,
          title: msg.title,
          description: msg.description,
          contextNote: msg.contextNote,
          noteForDev: msg.noteForDev,
          noteForQA: msg.noteForQA,
          noteForUIUX: msg.noteForUIUX,
          issueType: msg.issueType,
          priority: msg.priority,
          deps: msg.deps,
        };
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.state.timerStartedAt = timerStartedAt;

        this.broadcast({
          type: "TICKET_OPENED",
          ticketId: msg.ticketId,
          jiraKey: msg.jiraKey,
          title: msg.title,
          description: msg.description,
          contextNote: msg.contextNote,
          noteForDev: msg.noteForDev,
          noteForQA: msg.noteForQA,
          noteForUIUX: msg.noteForUIUX,
          issueType: msg.issueType,
          priority: msg.priority,
          deps: msg.deps,
          timerDuration: this.state.timerDuration,
          timerStartedAt: timerStartedAt ?? undefined,
        });
        await this.persist();
        break;
      }

      case "VOTE_CAST": {
        if (this.state.revealed) break; // too late
        if (!this.state.checkedIn.some((m) => m.memberId === msg.memberId)) return;
        this.state.votes[msg.memberId] = msg.value;

        this.broadcast({
          type: "VOTE_PROGRESS",
          votedCount: Object.keys(this.state.votes).length,
          totalCount: this.state.checkedIn.length,
          votedMemberIds: Object.keys(this.state.votes),
        });
        await this.persist();
        break;
      }

      case "REVEAL_VOTES": {
        if (!this.isAdmin(sender)) return;
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
        await this.persist();
        break;
      }

      case "LOCK_ESTIMATE": {
        if (!this.isAdmin(sender)) return;
        this.state.lockedTickets.push(msg.ticketId);
        if (msg.assigneeId) this.state.lockedTicketAssignees[msg.ticketId] = msg.assigneeId;
        this.state.currentTicket = null;
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.state.timerStartedAt = null;

        this.broadcast({ type: "ESTIMATE_LOCKED", ticketId: msg.ticketId, value: msg.value, assigneeId: msg.assigneeId });
        await this.persist();
        break;
      }

      case "REACTION": {
        if (!this.state.checkedIn.some((m) => m.memberId === msg.memberId)) return;
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
        if (!this.state.checkedIn.some((m) => m.memberId === msg.memberId)) return;
        this.broadcast({ type: "LEAVE_UPDATED", memberId: msg.memberId, date: msg.date, active: msg.active });
        break;
      }

      case "PUSH_CALENDAR": {
        if (!this.isAdmin(sender)) return;
        this.broadcast({ type: "CALENDAR_UPDATED" });
        break;
      }

      case "UPDATE_NOTE": {
        if (!this.isAdmin(sender)) return;
        if (this.state.currentTicket?.ticketId === msg.ticketId) {
          if (!msg.noteRole) {
            this.state.currentTicket.contextNote = msg.note;
          } else if (msg.noteRole === "DEV") {
            this.state.currentTicket.noteForDev = msg.note;
          } else if (msg.noteRole === "QA") {
            this.state.currentTicket.noteForQA = msg.note;
          } else if (msg.noteRole === "UI_UX") {
            this.state.currentTicket.noteForUIUX = msg.note;
          }
        }
        this.broadcast({ type: "NOTE_UPDATED", ticketId: msg.ticketId, note: msg.note, noteRole: msg.noteRole });
        await this.persist();
        break;
      }

      case "END_SESSION": {
        if (!this.isAdmin(sender)) return;
        this.broadcast({ type: "SESSION_ENDED" });
        await this.persist();
        break;
      }

      case "UPDATE_TICKET_DESIGN": {
        const designSender = this.state.checkedIn.find((m) => m.memberId === sender.id);
        if (!this.isAdmin(sender) && designSender?.role !== "UI_UX") return;
        this.broadcast({ type: "TICKET_DESIGN_UPDATED", ticketId: msg.ticketId, designReadiness: msg.designReadiness, designComplexity: msg.designComplexity, designLink: msg.designLink });
        break;
      }

      case "UPDATE_TICKET_TAGS": {
        const tagSender = this.state.checkedIn.find((m) => m.memberId === sender.id);
        if (!this.isAdmin(sender) && tagSender?.role !== "TECH_LEAD") return;
        this.broadcast({ type: "TICKET_TAGS_UPDATED", ticketId: msg.ticketId, tags: msg.tags });
        break;
      }

      case "TICKET_FLAGGED": {
        const flagSender = this.state.checkedIn.find((m) => m.memberId === sender.id);
        if (!this.isAdmin(sender) && flagSender?.role !== "TECH_LEAD") return;
        const current = this.state.ticketFlags[msg.ticketId] ?? [];
        const updated = msg.active
          ? [...new Set([...current, msg.flag])]
          : current.filter((f) => f !== msg.flag);
        this.state.ticketFlags[msg.ticketId] = updated;
        this.broadcast({ type: "TICKET_FLAGS_UPDATED", ticketId: msg.ticketId, flags: updated });
        await this.persist();
        break;
      }

      case "KICK_MEMBER": {
        if (!this.isAdmin(sender)) return;
        this.state.checkedIn = this.state.checkedIn.filter((m) => m.memberId !== msg.memberId);
        // Also remove their vote if pending
        delete this.state.votes[msg.memberId];
        this.broadcast({ type: "MEMBER_KICKED", memberId: msg.memberId });
        this.broadcast({ type: "PRESENCE_UPDATE", checkedIn: this.state.checkedIn });
        await this.persist();
        break;
      }
    }
  }

  // Reconnecting clients get current state automatically on connect
  private publicState(): PublicState {
    return {
      serverVersion: "2026-06-05.1",
      sessionStatus: this.state.sessionStatus,
      checkedIn: this.state.checkedIn,
      currentTicket: this.state.currentTicket,
      votedMemberIds: Object.keys(this.state.votes),
      revealed: this.state.revealed,
      revealedVotes: this.state.revealedVotes,
      lockedTickets: this.state.lockedTickets,
      lockedTicketAssignees: this.state.lockedTicketAssignees,
      timerDuration: this.state.timerDuration,
      timerStartedAt: this.state.timerStartedAt,
      ticketFlags: this.state.ticketFlags,
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
