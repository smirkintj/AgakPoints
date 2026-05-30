/**
 * In-process PartyKit WebSocket mock server.
 *
 * Usage in tests:
 *   const ws = new WsMockServer();
 *   await ws.attach(page);          // register the route interceptor
 *   await page.goto('/test-fixtures/participant');
 *   ws.broadcast({ type: 'TICKET_OPENED', ... });
 *   await ws.waitForMessage('VOTE_CAST');
 */

import type { Page } from "@playwright/test";

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

interface RoomState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: {
    ticketId: string;
    jiraKey: string;
    title: string;
    description?: string;
    contextNote?: string;
    issueType?: string;
    priority?: string;
  } | null;
  votes: Record<string, number>;
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
}

export class WsMockServer {
  state: RoomState = {
    sessionStatus: "WAITING",
    checkedIn: [],
    currentTicket: null,
    votes: {},
    revealed: false,
    revealedVotes: null,
    lockedTickets: [],
    lockedTicketAssignees: {},
  };

  private sends: Array<(msg: string) => void> = [];
  private receivedMessages: Array<{ type: string; payload: unknown }> = [];
  private messageListeners: Array<(msg: { type: string; payload: unknown }) => void> = [];

  broadcast(msg: object) {
    const json = JSON.stringify(msg);
    for (const fn of this.sends) {
      try { fn(json); } catch { /* page may have closed */ }
    }
  }

  /** Attach to a page — must be called before page.goto() */
  async attach(page: Page) {
    await page.routeWebSocket(/.*/, (wsRoute) => {
      const sendFn = (msg: string) => wsRoute.send(msg);
      this.sends.push(sendFn);

      // Send initial state immediately on connect
      wsRoute.send(JSON.stringify({ type: "STATE_SYNC", state: this.publicState() }));

      wsRoute.onMessage((rawMessage) => {
        const msg = JSON.parse(rawMessage as string);
        this.receivedMessages.push({ type: msg.type, payload: msg });
        for (const listener of this.messageListeners) listener({ type: msg.type, payload: msg });
        this.handleMessage(msg, sendFn);
      });
    });
  }

  /** Block until a message of the given type arrives from the browser */
  waitForMessage(type: string, timeout = 8_000): Promise<unknown> {
    const already = this.receivedMessages.find((m) => m.type === type);
    if (already) return Promise.resolve(already.payload);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for WS message: ${type}`)), timeout);
      this.messageListeners.push((msg) => {
        if (msg.type === type) {
          clearTimeout(timer);
          resolve(msg.payload);
        }
      });
    });
  }

  reset() {
    this.state = {
      sessionStatus: "WAITING",
      checkedIn: [],
      currentTicket: null,
      votes: {},
      revealed: false,
      revealedVotes: null,
      lockedTickets: [],
      lockedTicketAssignees: {},
    };
    this.sends = [];
    this.receivedMessages = [];
    this.messageListeners = [];
  }

  private handleMessage(msg: Record<string, unknown>, _senderFn: (m: string) => void) {
    switch (msg.type) {
      case "REQUEST_STATE": {
        _senderFn(JSON.stringify({ type: "STATE_SYNC", state: this.publicState() }));
        break;
      }
      case "CHECKIN": {
        const exists = this.state.checkedIn.find((m) => m.memberId === msg.memberId);
        if (!exists) {
          this.state.checkedIn.push({
            memberId: msg.memberId as string,
            memberName: msg.memberName as string,
            role: msg.role as string,
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
        this.state.currentTicket = {
          ticketId: msg.ticketId as string,
          jiraKey: msg.jiraKey as string,
          title: msg.title as string,
          description: msg.description as string | undefined,
          contextNote: msg.contextNote as string | undefined,
          issueType: msg.issueType as string | undefined,
          priority: msg.priority as string | undefined,
        };
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.broadcast({ type: "TICKET_OPENED", ...this.state.currentTicket });
        break;
      }
      case "VOTE_CAST": {
        if (!this.state.revealed) {
          this.state.votes[msg.memberId as string] = msg.value as number;
          this.broadcast({
            type: "VOTE_PROGRESS",
            votedCount: Object.keys(this.state.votes).length,
            totalCount: this.state.checkedIn.length,
            votedMemberIds: Object.keys(this.state.votes),
          });
        }
        break;
      }
      case "REVEAL_VOTES": {
        this.state.revealed = true;
        const memberMap = Object.fromEntries(this.state.checkedIn.map((m) => [m.memberId, m.memberName]));
        this.state.revealedVotes = Object.entries(this.state.votes).map(([memberId, value]) => ({
          memberId,
          memberName: memberMap[memberId] ?? "Unknown",
          value,
        }));
        const values = this.state.revealedVotes.map((v) => v.value);
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const med = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        this.broadcast({
          type: "VOTES_REVEALED",
          votes: this.state.revealedVotes,
          median: med,
          isConsensus: new Set(values).size === 1,
        });
        break;
      }
      case "LOCK_ESTIMATE": {
        this.state.lockedTickets.push(msg.ticketId as string);
        if (msg.assigneeId) this.state.lockedTicketAssignees[msg.ticketId as string] = msg.assigneeId as string;
        this.state.currentTicket = null;
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.broadcast({ type: "ESTIMATE_LOCKED", ticketId: msg.ticketId, value: msg.value, assigneeId: msg.assigneeId });
        break;
      }
      case "END_SESSION": {
        this.state.sessionStatus = "COMPLETED";
        this.broadcast({ type: "SESSION_ENDED" });
        break;
      }
      case "REACTION": {
        this.broadcast({ type: "REACTION_RECEIVED", memberId: msg.memberId, memberName: msg.memberName, emoji: msg.emoji });
        break;
      }
    }
  }

  private publicState() {
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
}

/** Mock all session API routes (leave, holidays, checkin, lock, end) */
export async function mockSessionApis(page: Page) {
  await page.route("**/api/sessions/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/leave") && method === "GET")
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leaves: [] }) });
    if (url.includes("/holidays") && method === "GET")
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ holidays: [] }) });
    if (url.includes("/checkin"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    if (url.includes("/lock"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jiraSync: null }) });
    if (url.includes("/end"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    if (url.includes("/summary"))
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });

    route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/products/**", async (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ capacity: 20 }) });
  });
}
