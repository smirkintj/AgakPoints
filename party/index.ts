import type * as Party from "partykit/server";
import type { PartyClientMessage, PartyServerMessage, RoomState } from "../src/types/partykit";

export default class AgakPointsServer implements Party.Server {
  private state: RoomState = {
    status: "WAITING",
    currentTicketId: null,
    checkedIn: [],
    votes: {},
    revealed: false,
    totalParticipants: 0,
  };

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Send current state to newly connected client
    conn.send(
      JSON.stringify({
        type: "PRESENCE_UPDATE",
        checkedIn: this.state.checkedIn,
      } satisfies PartyServerMessage)
    );

    if (this.state.currentTicketId && this.state.status === "ACTIVE") {
      conn.send(
        JSON.stringify({
          type: "VOTE_PROGRESS",
          votedCount: Object.keys(this.state.votes).length,
          totalCount: this.state.checkedIn.length,
          votedMemberIds: Object.keys(this.state.votes),
        } satisfies PartyServerMessage)
      );
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as PartyClientMessage;

    switch (msg.type) {
      case "CHECKIN": {
        const alreadyIn = this.state.checkedIn.find((m) => m.memberId === msg.memberId);
        if (!alreadyIn) {
          this.state.checkedIn.push({ memberId: msg.memberId, memberName: msg.memberName });
          this.state.totalParticipants = this.state.checkedIn.length;
        }
        this.broadcast({
          type: "PRESENCE_UPDATE",
          checkedIn: this.state.checkedIn,
        });
        break;
      }

      case "START_SESSION": {
        this.state.status = "ACTIVE";
        this.broadcast({ type: "SESSION_STARTED" });
        break;
      }

      case "OPEN_TICKET": {
        this.state.currentTicketId = msg.ticketId;
        this.state.votes = {};
        this.state.revealed = false;
        // ticketId, title, description are fetched by client from DB
        // we just relay the ticketId
        this.broadcast({
          type: "TICKET_OPENED",
          ticketId: msg.ticketId,
          jiraKey: "",
          title: "",
        });
        break;
      }

      case "VOTE_CAST": {
        if (this.state.revealed) break;
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
        const votes = Object.entries(this.state.votes).map(([memberId, value]) => ({
          memberId,
          memberName: memberMap[memberId] ?? "Unknown",
          value,
        }));
        this.broadcast({ type: "VOTES_REVEALED", votes });
        break;
      }

      case "LOCK_ESTIMATE": {
        this.state.votes = {};
        this.state.revealed = false;
        this.state.currentTicketId = null;
        this.broadcast({ type: "ESTIMATE_LOCKED", ticketId: msg.ticketId, value: msg.value });
        break;
      }

      case "REACTION": {
        const member = this.state.checkedIn.find((m) => m.memberId === msg.memberId);
        this.broadcast({
          type: "REACTION_RECEIVED",
          memberId: msg.memberId,
          memberName: member?.memberName ?? "Unknown",
          emoji: msg.emoji,
        });
        break;
      }

      case "NEXT_TICKET": {
        this.state.votes = {};
        this.state.revealed = false;
        this.state.currentTicketId = null;
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    // Presence is maintained via explicit CHECKIN — don't remove on disconnect
    // (participants may just refresh the page)
  }

  private broadcast(msg: PartyServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

AgakPointsServer satisfies Party.Worker;
