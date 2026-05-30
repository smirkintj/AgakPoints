/**
 * Real Node.js WebSocket server that runs on port 1999 during E2E tests.
 * Implements the same message protocol as party/index.ts so PartySocket clients
 * connect to it exactly as they would to the real PartyKit server.
 *
 * Usage:
 *   const server = new TestWsServer();
 *   await server.start();        // call once per test suite (globalSetup)
 *   server.reset();              // call between tests to clear state
 *   await server.stop();         // call in globalTeardown
 *
 *   Or use the helper per-test:
 *   const server = await TestWsServer.createAndStart();
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

interface CheckedInMember { memberId: string; memberName: string; role: string }
interface RevealedVote   { memberId: string; memberName: string; value: number }

interface RoomState {
  sessionStatus: "WAITING" | "ACTIVE" | "COMPLETED";
  checkedIn: CheckedInMember[];
  currentTicket: {
    ticketId: string; jiraKey: string; title: string;
    description?: string; contextNote?: string; issueType?: string; priority?: string
  } | null;
  votes: Record<string, number>;
  revealed: boolean;
  revealedVotes: RevealedVote[] | null;
  lockedTickets: string[];
  lockedTicketAssignees: Record<string, string>;
}

const DEFAULT_STATE = (): RoomState => ({
  sessionStatus: "WAITING",
  checkedIn: [],
  currentTicket: null,
  votes: {},
  revealed: false,
  revealedVotes: null,
  lockedTickets: [],
  lockedTicketAssignees: {},
});

export class TestWsServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private receivedMessages: Array<{ type: string; payload: Record<string, unknown> }> = [];
  private messageListeners: Array<(msg: { type: string; payload: Record<string, unknown> }) => void> = [];

  state: RoomState = DEFAULT_STATE();

  async start(port = 1999): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port });
      this.wss.on("listening", () => resolve());
      this.wss.on("error", reject);
      this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
        this.clients.add(ws);

        // Send STATE_SYNC immediately on connect
        ws.send(JSON.stringify({ type: "STATE_SYNC", state: this.publicState() }));

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
            this.receivedMessages.push({ type: msg.type as string, payload: msg });
            for (const l of this.messageListeners) l({ type: msg.type as string, payload: msg });
            this.handleMessage(msg, ws);
          } catch { /* ignore malformed */ }
        });

        ws.on("close", () => this.clients.delete(ws));
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) return resolve();
      for (const c of this.clients) c.terminate();
      this.wss.close(() => resolve());
      this.wss = null;
    });
  }

  reset(): void {
    this.state = DEFAULT_STATE();
    this.receivedMessages = [];
    this.messageListeners = [];
  }

  broadcast(msg: object): void {
    const json = JSON.stringify(msg);
    for (const c of this.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(json);
    }
  }

  waitForMessage(type: string, timeout = 8_000): Promise<Record<string, unknown>> {
    const already = this.receivedMessages.find((m) => m.type === type);
    if (already) return Promise.resolve(already.payload);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timeout waiting for WS message: ${type}`)), timeout);
      this.messageListeners.push((msg) => {
        if (msg.type === type) { clearTimeout(t); resolve(msg.payload); }
      });
    });
  }

  private handleMessage(msg: Record<string, unknown>, sender: WebSocket): void {
    switch (msg.type) {
      case "REQUEST_STATE":
        sender.send(JSON.stringify({ type: "STATE_SYNC", state: this.publicState() }));
        break;
      case "CHECKIN": {
        const exists = this.state.checkedIn.find((m) => m.memberId === msg.memberId);
        if (!exists) this.state.checkedIn.push({ memberId: msg.memberId as string, memberName: msg.memberName as string, role: msg.role as string });
        this.broadcast({ type: "PRESENCE_UPDATE", checkedIn: this.state.checkedIn });
        break;
      }
      case "START_SESSION":
        this.state.sessionStatus = "ACTIVE";
        this.broadcast({ type: "SESSION_STARTED" });
        break;
      case "OPEN_TICKET":
        this.state.currentTicket = { ticketId: msg.ticketId as string, jiraKey: msg.jiraKey as string, title: msg.title as string, description: msg.description as string | undefined, contextNote: msg.contextNote as string | undefined, issueType: msg.issueType as string | undefined, priority: msg.priority as string | undefined };
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.broadcast({ type: "TICKET_OPENED", ...this.state.currentTicket });
        break;
      case "VOTE_CAST":
        if (!this.state.revealed) {
          this.state.votes[msg.memberId as string] = msg.value as number;
          this.broadcast({ type: "VOTE_PROGRESS", votedCount: Object.keys(this.state.votes).length, totalCount: this.state.checkedIn.length, votedMemberIds: Object.keys(this.state.votes) });
        }
        break;
      case "REVEAL_VOTES": {
        this.state.revealed = true;
        const memberMap = Object.fromEntries(this.state.checkedIn.map((m) => [m.memberId, m.memberName]));
        this.state.revealedVotes = Object.entries(this.state.votes).map(([id, val]) => ({ memberId: id, memberName: memberMap[id] ?? "Unknown", value: val }));
        const values = this.state.revealedVotes.map((v) => v.value);
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const med = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
        this.broadcast({ type: "VOTES_REVEALED", votes: this.state.revealedVotes, median: med, isConsensus: new Set(values).size === 1 });
        break;
      }
      case "LOCK_ESTIMATE":
        this.state.lockedTickets.push(msg.ticketId as string);
        if (msg.assigneeId) this.state.lockedTicketAssignees[msg.ticketId as string] = msg.assigneeId as string;
        this.state.currentTicket = null;
        this.state.votes = {};
        this.state.revealed = false;
        this.state.revealedVotes = null;
        this.broadcast({ type: "ESTIMATE_LOCKED", ticketId: msg.ticketId, value: msg.value, assigneeId: msg.assigneeId });
        break;
      case "END_SESSION":
        this.state.sessionStatus = "COMPLETED";
        this.broadcast({ type: "SESSION_ENDED" });
        break;
      case "REACTION":
        this.broadcast({ type: "REACTION_RECEIVED", memberId: msg.memberId, memberName: msg.memberName, emoji: msg.emoji });
        break;
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

  static async createAndStart(port = 1999): Promise<TestWsServer> {
    const s = new TestWsServer();
    await s.start(port);
    return s;
  }
}

/** Shared singleton for tests in a single worker */
let _sharedServer: TestWsServer | null = null;

export async function getSharedWsServer(): Promise<TestWsServer> {
  if (!_sharedServer) {
    _sharedServer = new TestWsServer();
    await _sharedServer.start();
  }
  return _sharedServer;
}

export async function stopSharedWsServer(): Promise<void> {
  if (_sharedServer) {
    await _sharedServer.stop();
    _sharedServer = null;
  }
}
