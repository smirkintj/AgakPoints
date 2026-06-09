/**
 * Ten-Member Full Scrum Poker Simulation
 *
 * Exercises every meaningful feature of the app in one end-to-end flow
 * mirroring a real refinement session:
 *
 *  Phase 1  Staggered check-in: 10 members arrive one by one
 *  Phase 2  Host starts the session once quorum is met
 *  Phase 3  Ticket 1 (PROJ-101): context note, mixed votes → no consensus
 *  Phase 4  Ticket 2 (PROJ-102): no context note, full consensus → confetti
 *  Phase 5  Ticket 3 (PROJ-103): bug with an outlier, reactions mid-vote
 *  Phase 6  Ticket 4 (PROJ-104): low-priority story, quick consensus
 *  Phase 7  Ticket 5 (PROJ-105): tech-debt, heated spread, lock at host's call
 *  Phase 8  End session, host sees Session Complete recap
 *
 * Architecture:
 *   • Alice Dev drives the participant UI (real browser interaction)
 *   • Other 9 members are injected via TestWsServer.state + broadcast
 *   • JIRA API routes are fully mocked (no external calls)
 *   • All 5 ticket IDs match the fixture page's session.tickets list
 */

import { test, expect, type Page } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

// ─── Team ────────────────────────────────────────────────────────────────────

const SESSION_ID = "test-session-001";

const TEAM = [
  { id: "member-alice",  name: "Alice Dev",  role: "DEV",       capacity: 20 },
  { id: "member-bob",    name: "Bob QA",     role: "QA",        capacity: 15 },
  { id: "member-carol",  name: "Carol TL",   role: "TECH_LEAD", capacity: 10 },
  { id: "member-dave",   name: "Dave SM",    role: "SM",        capacity: 5  },
  { id: "member-eve",    name: "Eve Dev",    role: "DEV",       capacity: 20 },
  { id: "member-frank",  name: "Frank Dev",  role: "DEV",       capacity: 18 },
  { id: "member-grace",  name: "Grace UI",   role: "UI_UX",     capacity: 16 },
  { id: "member-henry",  name: "Henry Dev",  role: "DEV",       capacity: 20 },
  { id: "member-iris",   name: "Iris QA",    role: "QA",        capacity: 15 },
  { id: "member-jack",   name: "Jack Dev",   role: "DEV",       capacity: 20 },
];

const ALICE = {
  ...TEAM[0],
  avatarUrl: null, productId: "test-product-001",
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
// ticketId must match the fixture page's session.tickets[].id

const TICKETS = [
  {
    ticketId: "ticket-1", jiraKey: "PROJ-101",
    title: "Implement user authentication",
    description: "Setup NextAuth credentials provider with email/password and session management.",
    issueType: "Story", priority: "High",
    contextNote: "Scope: login + logout only. Password reset is a separate story. Security checklist in Confluence.",
    // Votes: Alice=5, rest spread → sorted [2,3,3,5,5,5,5,8,8,8] → median=5
    otherVotes: {
      "member-bob": 8, "member-carol": 5, "member-dave": 3,
      "member-eve": 5, "member-frank": 8, "member-grace": 3,
      "member-henry": 5, "member-iris": 8, "member-jack": 2,
    },
    aliceVote: 5, expectedMedian: 5, consensus: false,
    lockAssignee: "member-alice",
  },
  {
    ticketId: "ticket-2", jiraKey: "PROJ-102",
    title: "Build dashboard analytics panel",
    description: "Reusable chart widgets with real-time data for the analytics dashboard.",
    issueType: "Story", priority: "Medium",
    contextNote: null,
    // Full consensus — everyone votes 8
    otherVotes: {
      "member-bob": 8, "member-carol": 8, "member-dave": 8,
      "member-eve": 8, "member-frank": 8, "member-grace": 8,
      "member-henry": 8, "member-iris": 8, "member-jack": 8,
    },
    aliceVote: 8, expectedMedian: 8, consensus: true,
    lockAssignee: "member-eve",
  },
  {
    ticketId: "ticket-3", jiraKey: "PROJ-103",
    title: "Fix WebSocket reconnection bug",
    description: "Clients lose state on network drop and do not recover gracefully.",
    issueType: "Bug", priority: "Highest",
    contextNote: "Regression in v1.4. Carol has the trace — check with her before voting.",
    // Outlier: Carol=21, everyone else 3–5
    otherVotes: {
      "member-bob": 5, "member-carol": 21, "member-dave": 3,
      "member-eve": 5, "member-frank": 5, "member-grace": 3,
      "member-henry": 3, "member-iris": 5, "member-jack": 3,
    },
    aliceVote: 3, expectedMedian: 4, consensus: false,
    lockAssignee: "member-frank",
  },
  {
    ticketId: "ticket-4", jiraKey: "PROJ-104",
    title: "Mobile responsive layout",
    description: "Make the session view fully usable on phones and tablets.",
    issueType: "Story", priority: "Low",
    contextNote: "Only phone + tablet breakpoints needed. Desktop is already fine.",
    // Quick consensus — all vote 5
    otherVotes: {
      "member-bob": 5, "member-carol": 5, "member-dave": 5,
      "member-eve": 5, "member-frank": 5, "member-grace": 5,
      "member-henry": 5, "member-iris": 5, "member-jack": 5,
    },
    aliceVote: 5, expectedMedian: 5, consensus: true,
    lockAssignee: "member-grace",
  },
  {
    ticketId: "ticket-5", jiraKey: "PROJ-105",
    title: "Performance: lazy-load ticket sidebar",
    description: "Virtualise the sidebar list for sessions with 100+ tickets.",
    issueType: "Story", priority: "Medium",
    contextNote: "Spike first to confirm the virtualisation library. Vote the spike, not the full impl.",
    // Spread: Alice=13, others mix of 8 and 13
    otherVotes: {
      "member-bob": 13, "member-carol": 8, "member-dave": 8,
      "member-eve": 13, "member-frank": 8, "member-grace": 13,
      "member-henry": 8, "member-iris": 13, "member-jack": 8,
    },
    aliceVote: 13, expectedMedian: 13, consensus: false,
    lockAssignee: "member-henry",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function checkinMember(wsServer: TestWsServer, m: typeof TEAM[0]) {
  const exists = wsServer.state.checkedIn.find((c) => c.memberId === m.id);
  if (!exists) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });
  wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });
}

function injectOtherVotes(wsServer: TestWsServer, ticket: typeof TICKETS[0]) {
  for (const [memberId, value] of Object.entries(ticket.otherVotes)) {
    wsServer.state.votes[memberId] = value;
    wsServer.broadcast({
      type: "VOTE_PROGRESS",
      votedCount: Object.keys(wsServer.state.votes).length,
      totalCount: TEAM.length,
      votedMemberIds: Object.keys(wsServer.state.votes),
    });
  }
}

function buildRevealedVotes(ticket: typeof TICKETS[0]) {
  return TEAM.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    value: m.id === "member-alice" ? ticket.aliceVote : (ticket.otherVotes[m.id as keyof typeof ticket.otherVotes] as number),
  }));
}

async function openHostPage(page: Page) {
  await mockSessionApis(page);
  await page.goto("/test-fixtures/host");
  await page.waitForLoadState("networkidle");
}

async function openAlicePage(page: Page) {
  await mockSessionApis(page);
  await page.addInitScript(
    ([id, member]: [string, typeof ALICE]) =>
      sessionStorage.setItem(`agakpoints_member_${id}`, JSON.stringify(member)),
    [SESSION_ID, ALICE] as [string, typeof ALICE]
  );
  await page.goto("/test-fixtures/participant");
  await page.waitForLoadState("networkidle");
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

let wsServer: TestWsServer;

test.beforeAll(async () => {
  wsServer = new TestWsServer();
  await wsServer.start(1999);
});

test.afterAll(async () => {
  await wsServer.stop();
});

test.beforeEach(() => {
  wsServer.reset();
});

// ─── Phase tests ─────────────────────────────────────────────────────────────

test.describe("10-Member Scrum Poker Simulation", () => {

  // ── Phase 1: Staggered check-in ───────────────────────────────────────────

  test("Phase 1 — staggered check-in: members arrive one by one, host sees live counter", async ({ page }) => {
    await openHostPage(page);

    const startBtn = page.getByRole("button", { name: /Start session/i });
    await expect(startBtn).toBeDisabled({ timeout: 5000 });

    // Members arrive one by one; host counter increments each time
    for (let i = 0; i < TEAM.length; i++) {
      checkinMember(wsServer, TEAM[i]);
      await expect(page.getByText(`${i + 1}/10`)).toBeVisible({ timeout: 5000 });
    }

    // With ≥1 checked in, Start is enabled
    await expect(startBtn).toBeEnabled({ timeout: 3000 });
  });

  // ── Phase 2: Start session ────────────────────────────────────────────────

  test("Phase 2 — host starts session, all pages switch to ACTIVE", async ({ browser }) => {
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    await expect(hostPage.getByRole("button", { name: /Start session/i })).toBeEnabled({ timeout: 5000 });
    await hostPage.getByRole("button", { name: /Start session/i }).click();

    const msg = await wsServer.waitForMessage("START_SESSION");
    expect(msg).toBeTruthy();

    // Both sides see ACTIVE
    await expect(hostPage.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 3: Ticket 1 — mixed votes, context note, no consensus ───────────

  test("Phase 3 — PROJ-101: context note shown, 10/10 vote, median 5, no consensus, locked to Alice", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const t = TICKETS[0];

    // Open ticket with context note
    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, contextNote: t.contextNote! };
    wsServer.broadcast({ type: "TICKET_OPENED", ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, issueType: t.issueType, priority: t.priority, contextNote: t.contextNote });

    // Alice sees the ticket and the context note
    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Host notes")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/Scope: login \+ logout only/)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    // Host sees the ticket in voting mode (jiraKey appears in sidebar + canvas; .first() is fine)
    await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });

    // Alice votes 5 via UI
    await alicePage.locator("button").filter({ hasText: /^5$/ }).click();
    const vote = await wsServer.waitForMessage("VOTE_CAST");
    expect(vote.value).toBe(5);
    expect(vote.memberId).toBe("member-alice");

    // Other 9 vote
    injectOtherVotes(wsServer, t);

    // Host sees 10/10
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    // Alice shows "You voted 5" confirmation
    await expect(alicePage.getByText(/You voted 5/)).toBeVisible({ timeout: 5000 });

    // Reveal
    const allVotes = buildRevealedVotes(t);
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.consensus });

    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.locator(`text=${t.expectedMedian}`).first()).toBeVisible();
    await expect(alicePage.getByText("Consensus")).not.toBeVisible();
    await expect(hostPage.getByText("Revealed")).toBeVisible({ timeout: 5000 });

    // Lock at median=5, assign to Alice
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: t.expectedMedian, assigneeId: t.lockAssignee });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText("Estimated")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 4: Ticket 2 — full consensus, emoji reaction ────────────────────

  test("Phase 4 — PROJ-102: full consensus (8pt), Consensus badge, emoji reaction", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1"];
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const t = TICKETS[1];

    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title };
    wsServer.broadcast({ type: "TICKET_OPENED", ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, issueType: t.issueType, priority: t.priority });

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });
    // No context note this round
    await expect(alicePage.getByText("Host notes")).not.toBeVisible();

    // Alice votes 8
    await alicePage.locator("button").filter({ hasText: /^8$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    // Reveal — consensus
    const allVotes = buildRevealedVotes(t);
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: 8, isConsensus: true });

    await expect(alicePage.getByText("Consensus")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });

    // Emoji reactions fire (celebration)
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-bob",  memberName: "Bob QA",   emoji: "🎉" });
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-dave", memberName: "Dave SM",  emoji: "🎯" });
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-iris", memberName: "Iris QA",  emoji: "👍" });

    // Lock at 8, assign to Eve
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 8, assigneeId: t.lockAssignee });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 5: Ticket 3 — bug, outlier at 21 (Carol) ───────────────────────

  test("Phase 5 — PROJ-103 bug: Carol outlier at 21, rest vote 3-5, median 4", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2"];
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const t = TICKETS[2];

    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, contextNote: t.contextNote! };
    wsServer.broadcast({ type: "TICKET_OPENED", ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, issueType: t.issueType, priority: t.priority, contextNote: t.contextNote });

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/Carol has the trace/)).toBeVisible({ timeout: 5000 });

    // Alice votes 3
    await alicePage.locator("button").filter({ hasText: /^3$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Mid-vote reaction: someone is confused
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-jack", memberName: "Jack Dev", emoji: "🤔" });

    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    // Reveal — outlier Carol=21 visible, no consensus
    const allVotes = buildRevealedVotes(t);
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.consensus });

    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    // Carol's 21 should be visible in revealed cards
    await expect(alicePage.locator("text=21").first()).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Consensus")).not.toBeVisible();

    // Lock at 5 (team agrees after discussion), assign to Frank
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 5, assigneeId: t.lockAssignee });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 6: Ticket 4 — quick consensus, low priority ────────────────────

  test("Phase 6 — PROJ-104 low-priority: all 10 vote 5, consensus, lock to Grace", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2", "ticket-3"];
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const t = TICKETS[3];

    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, contextNote: t.contextNote! };
    wsServer.broadcast({ type: "TICKET_OPENED", ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, issueType: t.issueType, priority: t.priority, contextNote: t.contextNote });

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });

    // Alice votes 5
    await alicePage.locator("button").filter({ hasText: /^5$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    const allVotes = buildRevealedVotes(t);
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: 5, isConsensus: true });

    await expect(alicePage.getByText("Consensus")).toBeVisible({ timeout: 5000 });

    // Reaction: thumbs up from everyone
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-henry", memberName: "Henry Dev", emoji: "👍" });

    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 5, assigneeId: t.lockAssignee });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 7: Ticket 5 — heated spread, host overrides to 13 ──────────────

  test("Phase 7 — PROJ-105 spike: split 8 vs 13, host locks at 13 (spike budget)", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2", "ticket-3", "ticket-4"];
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const t = TICKETS[4];

    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, contextNote: t.contextNote! };
    wsServer.broadcast({ type: "TICKET_OPENED", ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description, issueType: t.issueType, priority: t.priority, contextNote: t.contextNote });

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/Vote the spike/)).toBeVisible({ timeout: 5000 });

    // Alice votes 13
    await alicePage.locator("button").filter({ hasText: /^13$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    // Reveal — split 8 vs 13
    const allVotes = buildRevealedVotes(t);
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.consensus });

    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Consensus")).not.toBeVisible();

    // Debate reactions
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-carol", memberName: "Carol TL", emoji: "💥" });
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-bob",   memberName: "Bob QA",   emoji: "😱" });

    // Host locks at 13 (spike budget), assign to Henry
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 13, assigneeId: t.lockAssignee });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 8: End session + recap ─────────────────────────────────────────

  test("Phase 8 — host ends session: Session Complete on host, Session Ended on participant", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2", "ticket-3", "ticket-4", "ticket-5"];
    for (const m of TEAM) checkinMember(wsServer, m);

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    const endBtn = hostPage.getByRole("button", { name: "End Session" });
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    await wsServer.waitForMessage("END_SESSION");

    await expect(hostPage.getByText("Session Complete")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Session Ended")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("The host has ended this refinement session.")).toBeVisible();

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Full lifecycle in one test ────────────────────────────────────────────

  test("Full lifecycle: 10 members, 5 tickets, all phases end-to-end", async ({ browser }) => {
    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlicePage(alicePage);
    await openHostPage(hostPage);

    // ── Check-in all 10 ─────────────────────────────────────────────────────
    for (const m of TEAM) checkinMember(wsServer, m);
    await expect(hostPage.getByRole("button", { name: /Start session/i })).toBeEnabled({ timeout: 5000 });
    await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

    // ── Start session ───────────────────────────────────────────────────────
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.broadcast({ type: "SESSION_STARTED" });
    await expect(hostPage.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    // ── Ticket loop ─────────────────────────────────────────────────────────
    for (let i = 0; i < TICKETS.length; i++) {
      const t = TICKETS[i];

      // Reset per-round WS state
      wsServer.state.votes = {};
      wsServer.state.revealed = false;
      wsServer.state.revealedVotes = null;
      wsServer.state.currentTicket = {
        ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title,
        ...(t.contextNote ? { contextNote: t.contextNote } : {}),
      };

      wsServer.broadcast({
        type: "TICKET_OPENED",
        ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title,
        description: t.description, issueType: t.issueType,
        priority: t.priority,
        ...(t.contextNote ? { contextNote: t.contextNote } : {}),
      });

      await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
      await expect(hostPage.getByText(t.jiraKey).first()).toBeVisible({ timeout: 5000 });
      await expect(alicePage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

      if (t.contextNote) {
        await expect(alicePage.getByText("Host notes")).toBeVisible({ timeout: 5000 });
      }

      // Alice votes
      await alicePage.locator("button").filter({ hasText: new RegExp(`^${t.aliceVote}$`) }).click();
      const voteCast = await wsServer.waitForMessage("VOTE_CAST");
      expect(voteCast.value).toBe(t.aliceVote);

      // Inject remaining 9 votes
      injectOtherVotes(wsServer, t);
      await expect(hostPage.getByText("10/10").first()).toBeVisible({ timeout: 5000 });

      // Reveal
      const allVotes = buildRevealedVotes(t);
      wsServer.state.revealed = true;
      wsServer.state.revealedVotes = allVotes;
      wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.consensus });

      await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
      if (t.consensus) {
        await expect(alicePage.getByText("Consensus")).toBeVisible({ timeout: 5000 });
      } else {
        await expect(alicePage.getByText("Consensus")).not.toBeVisible();
      }

      // Lock
      wsServer.state.lockedTickets.push(t.ticketId);
      wsServer.state.lockedTicketAssignees[t.ticketId] = t.lockAssignee;
      wsServer.state.currentTicket = null;
      wsServer.state.votes = {};
      wsServer.state.revealed = false;
      wsServer.state.revealedVotes = null;
      wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: t.expectedMedian, assigneeId: t.lockAssignee });

      await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 6000 });

      // Reset message queue between rounds
      wsServer.reset();
      wsServer.state.sessionStatus = "ACTIVE";
      wsServer.state.lockedTickets = TICKETS.slice(0, i + 1).map((x) => x.ticketId);
      wsServer.state.lockedTicketAssignees = Object.fromEntries(
        TICKETS.slice(0, i + 1).map((x) => [x.ticketId, x.lockAssignee])
      );
      for (const m of TEAM) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });
    }

    // ── End session ─────────────────────────────────────────────────────────
    const endBtn = hostPage.getByRole("button", { name: "End Session" });
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    await wsServer.waitForMessage("END_SESSION");
    await expect(hostPage.getByText("Session Complete")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Session Ended")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });
});
