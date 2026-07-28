import { describe, expect, it } from "vitest";
import {
  evalChaosAgent,
  evalLoadBearer,
  evalOptimist,
  evalOracle,
  evalPhilosopher,
  evalRealist,
  evaluateAll,
} from "./achievements";

const at = (seconds: number) => new Date(2026, 0, 1, 12, 0, seconds);

describe("evalOracle", () => {
  it("picks the member closest to the locked estimate most often", () => {
    const tickets = [
      { id: "t1", finalEstimate: 5 },
      { id: "t2", finalEstimate: 8 },
    ];
    const votes = [
      { ticketId: "t1", memberId: "alice", value: 5 },
      { ticketId: "t1", memberId: "bob", value: 1 },
      { ticketId: "t2", memberId: "alice", value: 8 },
      { ticketId: "t2", memberId: "bob", value: 1 },
    ];
    expect(evalOracle(votes, tickets)).toEqual([{ memberId: "alice" }]);
  });

  it("awards everyone tied for closest", () => {
    const tickets = [{ id: "t1", finalEstimate: 5 }];
    const votes = [
      { ticketId: "t1", memberId: "alice", value: 3 },
      { ticketId: "t1", memberId: "bob", value: 7 },
    ];
    expect(evalOracle(votes, tickets).map((m) => m.memberId).sort()).toEqual(["alice", "bob"]);
  });

  it("ignores tickets that were never locked", () => {
    const tickets = [{ id: "t1", finalEstimate: null }];
    const votes = [{ ticketId: "t1", memberId: "alice", value: 3 }];
    expect(evalOracle(votes, tickets)).toEqual([]);
  });

  it("returns nothing when there were no votes at all", () => {
    expect(evalOracle([], [{ id: "t1", finalEstimate: 5 }])).toEqual([]);
  });
});

describe("evalOptimist and evalRealist", () => {
  const tickets = [
    { id: "t1", finalEstimate: 5 },
    { id: "t2", finalEstimate: 5 },
    { id: "t3", finalEstimate: 5 },
  ];

  it("flags a member who consistently votes under the final estimate", () => {
    const votes = ["t1", "t2", "t3"].map((ticketId) => ({ ticketId, memberId: "alice", value: 2 }));
    expect(evalOptimist(votes, tickets)).toEqual([{ memberId: "alice" }]);
    expect(evalRealist(votes, tickets)).toEqual([]);
  });

  it("flags a member who consistently votes over it", () => {
    const votes = ["t1", "t2", "t3"].map((ticketId) => ({ ticketId, memberId: "bob", value: 13 }));
    expect(evalRealist(votes, tickets)).toEqual([{ memberId: "bob" }]);
    expect(evalOptimist(votes, tickets)).toEqual([]);
  });

  it("needs at least three votes before judging a pattern", () => {
    const votes = [
      { ticketId: "t1", memberId: "alice", value: 1 },
      { ticketId: "t2", memberId: "alice", value: 1 },
    ];
    expect(evalOptimist(votes, tickets)).toEqual([]);
  });

  it("does not flag someone who lands on the estimate", () => {
    const votes = ["t1", "t2", "t3"].map((ticketId) => ({ ticketId, memberId: "alice", value: 5 }));
    expect(evalOptimist(votes, tickets)).toEqual([]);
    expect(evalRealist(votes, tickets)).toEqual([]);
  });
});

describe("evalChaosAgent", () => {
  it("picks the widest vote spread once it exceeds the threshold", () => {
    const votes = [
      { ticketId: "t1", memberId: "alice", value: 1 },
      { ticketId: "t2", memberId: "alice", value: 21 },
      { ticketId: "t1", memberId: "bob", value: 3 },
      { ticketId: "t2", memberId: "bob", value: 5 },
    ];
    expect(evalChaosAgent(votes)).toEqual({ memberId: "alice" });
  });

  it("returns null when no spread is wide enough", () => {
    const votes = [
      { ticketId: "t1", memberId: "alice", value: 3 },
      { ticketId: "t2", memberId: "alice", value: 5 },
    ];
    expect(evalChaosAgent(votes)).toBeNull();
  });

  it("ignores members who only voted once", () => {
    expect(evalChaosAgent([{ ticketId: "t1", memberId: "alice", value: 21 }])).toBeNull();
  });
});

describe("evalLoadBearer", () => {
  it("picks whoever carries the most story points", () => {
    const assignments = [
      { memberId: "alice", storyPoints: 5 },
      { memberId: "alice", storyPoints: 3 },
      { memberId: "bob", storyPoints: 5 },
    ];
    expect(evalLoadBearer(assignments)).toEqual({ memberId: "alice" });
  });

  it("returns null with no assignments", () => {
    expect(evalLoadBearer([])).toBeNull();
  });

  it("returns null when every assignment is worth zero", () => {
    expect(evalLoadBearer([{ memberId: "alice", storyPoints: 0 }])).toBeNull();
  });
});

describe("evalPhilosopher", () => {
  it("picks whoever votes last most often", () => {
    const votesByTicket = [
      {
        ticketId: "t1",
        votes: [
          { memberId: "alice", createdAt: at(1) },
          { memberId: "bob", createdAt: at(9) },
        ],
      },
      {
        ticketId: "t2",
        votes: [
          { memberId: "alice", createdAt: at(1) },
          { memberId: "bob", createdAt: at(9) },
        ],
      },
    ];
    expect(evalPhilosopher(votesByTicket)).toEqual({ memberId: "bob" });
  });

  it("needs the pattern to repeat — being last once isn't enough", () => {
    const votesByTicket = [
      {
        ticketId: "t1",
        votes: [
          { memberId: "alice", createdAt: at(1) },
          { memberId: "bob", createdAt: at(9) },
        ],
      },
    ];
    expect(evalPhilosopher(votesByTicket)).toBeNull();
  });

  it("skips tickets with a single voter", () => {
    const votesByTicket = [
      { ticketId: "t1", votes: [{ memberId: "bob", createdAt: at(1) }] },
      { ticketId: "t2", votes: [{ memberId: "bob", createdAt: at(1) }] },
    ];
    expect(evalPhilosopher(votesByTicket)).toBeNull();
  });
});

describe("evaluateAll", () => {
  it("never awards the same badge to the same member twice", () => {
    const tickets = [
      { id: "t1", finalEstimate: 5 },
      { id: "t2", finalEstimate: 5 },
      { id: "t3", finalEstimate: 5 },
    ];
    const votes = tickets.map((t, i) => ({
      ticketId: t.id,
      memberId: "alice",
      value: 1,
      createdAt: at(i),
    }));

    const results = evaluateAll({
      tickets,
      votes,
      participants: [{ memberId: "alice" }],
      assignments: [{ memberId: "alice", storyPoints: 8 }],
    });

    const keys = results.map((r) => `${r.memberId}:${r.type}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("produces nothing for a session where no ticket was estimated", () => {
    expect(
      evaluateAll({ tickets: [], votes: [], participants: [], assignments: [] })
    ).toEqual([]);
  });
});
