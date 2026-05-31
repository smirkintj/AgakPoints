/**
 * Eight-Member Full Session Simulation
 *
 * Simulates a realistic scrum poker session with 8 participants across
 * three tickets. Alice (DEV) drives the participant UI; the other 7 members
 * are injected directly through the TestWsServer so the test stays fast
 * while still exercising the full broadcast/receive pipeline.
 *
 * Ticket round summary:
 *   PROJ-201  "User authentication flow"     → mixed votes (no consensus), median 5
 *   PROJ-202  "Dashboard widgets"            → full consensus, all vote 8
 *   PROJ-203  "Legacy migration spike"       → outlier round, one vote at 13, rest at 3
 */

import { test, expect, type Page } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

// ─── Constants ──────────────────────────────────────────────────────────────

const HOST_URL        = "/test-fixtures/host";
const PARTICIPANT_URL = "/test-fixtures/participant";
const SESSION_ID      = "test-session-001";

const MEMBERS = [
  { id: "member-alice",  name: "Alice Dev",    role: "DEV",       capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-bob",    name: "Bob QA",       role: "QA",        capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-carol",  name: "Carol TL",     role: "TECH_LEAD", capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-dave",   name: "Dave SM",      role: "SM",        capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-eve",    name: "Eve Dev",      role: "DEV",       capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-frank",  name: "Frank Dev",    role: "DEV",       capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-grace",  name: "Grace UI",     role: "UI_UX",     capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "member-henry",  name: "Henry Dev",    role: "DEV",       capacity: 20, avatarUrl: null, productId: "test-product-001", createdAt: "2026-01-01T00:00:00.000Z" },
];
const ALICE = MEMBERS[0];

const TICKETS = [
  {
    ticketId: "ticket-1", jiraKey: "PROJ-101",
    title: "Implement user authentication",
    description: "Implement NextAuth credentials provider with email/password login.",
    issueType: "Story", priority: "High",
    contextNote: "Focus on OWASP top 10 — especially session fixation and CSRF.",
    // Alice=5, Bob=8, Carol=5, Dave=3, Eve=5, Frank=8, Grace=3, Henry=5 → sorted=[3,3,5,5,5,5,8,8] median=5
    votes: { "member-bob": 8, "member-carol": 5, "member-dave": 3, "member-eve": 5, "member-frank": 8, "member-grace": 3, "member-henry": 5 },
    aliceVote: 5,
    expectedMedian: 5,
    expectedConsensus: false,
  },
  {
    ticketId: "ticket-2", jiraKey: "PROJ-102",
    title: "Build dashboard UI",
    description: "Build reusable chart widgets for the analytics dashboard.",
    issueType: "Story", priority: "Medium",
    contextNote: null,
    // All vote 8 → consensus
    votes: { "member-bob": 8, "member-carol": 8, "member-dave": 8, "member-eve": 8, "member-frank": 8, "member-grace": 8, "member-henry": 8 },
    aliceVote: 8,
    expectedMedian: 8,
    expectedConsensus: true,
  },
  {
    ticketId: "ticket-3", jiraKey: "PROJ-103",
    title: "Fix WebSocket reconnection bug",
    description: "Research and estimate effort for migrating from MySQL to Postgres.",
    issueType: "Bug", priority: "Highest",
    contextNote: "This is a spike — time-box to 2 days. Vote on the spike itself, not the migration.",
    // Alice=3, Bob=3, Carol=13 (outlier!), Dave=3, Eve=3, Frank=3, Grace=3, Henry=3 → median=3
    votes: { "member-bob": 3, "member-carol": 13, "member-dave": 3, "member-eve": 3, "member-frank": 3, "member-grace": 3, "member-henry": 3 },
    aliceVote: 3,
    expectedMedian: 3,
    expectedConsensus: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Inject all non-Alice votes directly into server state + broadcast progress. */
function injectOtherVotes(wsServer: TestWsServer, ticket: typeof TICKETS[0]) {
  const total = MEMBERS.length;
  // Already has Alice's vote in state.votes — add the others
  for (const [memberId, value] of Object.entries(ticket.votes)) {
    wsServer.state.votes[memberId] = value;
    const votedMemberIds = Object.keys(wsServer.state.votes);
    wsServer.broadcast({
      type: "VOTE_PROGRESS",
      votedCount: votedMemberIds.length,
      totalCount: total,
      votedMemberIds,
    });
  }
}

/** Open a host test-fixture page with API mocks and WS already connected. */
async function openHost(page: Page) {
  await mockSessionApis(page);
  await page.goto(HOST_URL);
  await page.waitForLoadState("networkidle");
}

/** Open the participant page as Alice. */
async function openAlice(page: Page) {
  await mockSessionApis(page);
  await page.addInitScript(
    ([id, member]: [string, typeof ALICE]) =>
      sessionStorage.setItem(`agakpoints_member_${id}`, JSON.stringify(member)),
    [SESSION_ID, ALICE] as [string, typeof ALICE]
  );
  await page.goto(PARTICIPANT_URL);
  await page.waitForLoadState("networkidle");
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

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

test.describe("8-Member Simulation", () => {

  // ── Phase 1: Lobby & Check-in ─────────────────────────────────────────────

  test("Phase 1 — all 8 members check in, host sees full roster", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    await openHost(hostPage);

    // Start with 0 checked-in — Start button should be disabled
    const startBtn = hostPage.getByRole("button", { name: /Start session/i });
    await expect(startBtn).toBeDisabled({ timeout: 5000 });

    // Check in all 8 members sequentially via WS
    for (const m of MEMBERS) {
      wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });
      wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });
    }

    // Host sees 8/3 (fixture only has 3 tickets but all 8 members checked in)
    // The "X/3" counter in the header reflects session member count
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await expect(hostPage.getByText("8/3")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
  });

  // ── Phase 2: Full ticket round — no consensus, outlier detection ──────────

  test("Phase 2 — Ticket 1: mixed votes, host reveals, median=5, no consensus", async ({ browser }) => {
    // Seed 8 checked-in members + ACTIVE session
    wsServer.state.sessionStatus = "ACTIVE";
    for (const m of MEMBERS) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlice(alicePage);
    await openHost(hostPage);

    // Alice waits for a ticket
    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    // Host opens PROJ-201 with a context note
    const t = TICKETS[0];
    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: t.ticketId, jiraKey: t.jiraKey,
      title: t.title, description: t.description,
      issueType: t.issueType, priority: t.priority,
      contextNote: t.contextNote,
    });
    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, description: t.description!, contextNote: t.contextNote!, issueType: t.issueType, priority: t.priority };

    // Alice sees the ticket + context note
    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Focus on OWASP top 10")).toBeVisible({ timeout: 5000 });

    // Alice votes 5 via UI
    await alicePage.locator("button").filter({ hasText: /^5$/ }).click();
    const vote = await wsServer.waitForMessage("VOTE_CAST");
    expect(vote.value).toBe(5);
    expect(vote.memberId).toBe("member-alice");

    // Inject all other 7 votes
    injectOtherVotes(wsServer, t);

    // Host sees 8/8 voted
    await expect(hostPage.getByText("8/8")).toBeVisible({ timeout: 5000 });

    // Alice's "You voted 5" confirmation
    await expect(alicePage.getByText(/You voted 5/)).toBeVisible({ timeout: 5000 });

    // Host reveals all votes
    const allVotes = MEMBERS.map((m) => ({
      memberId: m.id,
      memberName: m.name,
      value: m.id === "member-alice" ? t.aliceVote : (t.votes[m.id as keyof typeof t.votes] as number),
    }));
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.expectedConsensus });

    // Both sides see the reveal
    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.locator(`text=${t.expectedMedian}`).first()).toBeVisible();
    await expect(hostPage.getByText("Revealed")).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText(/Median/)).toBeVisible({ timeout: 5000 });

    // No consensus badge on non-consensus round
    await expect(alicePage.getByText("Consensus")).not.toBeVisible();

    // Host locks at median (5) and assigns to Alice
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.lockedTicketAssignees[t.ticketId] = "member-alice";
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: t.expectedMedian, assigneeId: "member-alice" });

    // Alice returns to waiting
    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });
    // Host sidebar shows Estimated section
    await expect(hostPage.getByText("Estimated")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Phase 3: Consensus round ───────────────────────────────────────────────

  test("Phase 3 — Ticket 2: all 8 vote 8, consensus badge appears", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1"];
    for (const m of MEMBERS) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });

    const aliceCtx = await browser.newContext();
    const hostCtx  = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const hostPage  = await hostCtx.newPage();

    await openAlice(alicePage);
    await openHost(hostPage);

    const t = TICKETS[1];

    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: t.ticketId, jiraKey: t.jiraKey,
      title: t.title, description: t.description,
      issueType: t.issueType, priority: t.priority,
    });
    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title };

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    // No context note for this ticket
    await expect(alicePage.getByText("Host notes")).not.toBeVisible();

    // Alice votes 8
    await alicePage.locator("button").filter({ hasText: /^8$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Inject all other 7 votes (all 8)
    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("8/8")).toBeVisible({ timeout: 5000 });

    // Reveal — full consensus
    const allVotes = MEMBERS.map((m) => ({ memberId: m.id, memberName: m.name, value: 8 }));
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: 8, isConsensus: true });

    // Alice and host both see Consensus badge
    await expect(alicePage.getByText("Consensus")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });

    // A reaction fires during consensus celebration
    wsServer.broadcast({ type: "REACTION_RECEIVED", memberId: "member-bob", memberName: "Bob QA", emoji: "🎉" });

    // Lock at 8
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 8 });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await aliceCtx.close();
    await hostCtx.close();
  });

  // ── Phase 4: Outlier round ────────────────────────────────────────────────

  test("Phase 4 — Ticket 3: Carol votes 13 (outlier), rest vote 3, median=3", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2"];
    for (const m of MEMBERS) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });

    const aliceCtx = await browser.newContext();
    const hostCtx  = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    const hostPage  = await hostCtx.newPage();

    await openAlice(alicePage);
    await openHost(hostPage);

    const t = TICKETS[2];

    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: t.ticketId, jiraKey: t.jiraKey,
      title: t.title, description: t.description,
      issueType: t.issueType, priority: t.priority,
      contextNote: t.contextNote,
    });
    wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, contextNote: t.contextNote! };

    await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("This is a spike")).toBeVisible({ timeout: 5000 });

    // Alice votes 3
    await alicePage.locator("button").filter({ hasText: /^3$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Inject other votes (Carol=13, rest=3)
    injectOtherVotes(wsServer, t);
    await expect(hostPage.getByText("8/8")).toBeVisible({ timeout: 5000 });

    // Reveal — outlier Carol at 13
    const allVotes = MEMBERS.map((m) => ({
      memberId: m.id,
      memberName: m.name,
      value: m.id === "member-alice" ? 3 : (t.votes[m.id as keyof typeof t.votes] as number),
    }));
    wsServer.state.revealed = true;
    wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: 3, isConsensus: false });

    await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.locator("text=3").first()).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Consensus")).not.toBeVisible();

    // Lock at 3 (the team agrees to stick with median, not outlier)
    wsServer.state.lockedTickets.push(t.ticketId);
    wsServer.state.currentTicket = null;
    wsServer.state.votes = {};
    wsServer.state.revealed = false;
    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: 3 });

    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    await aliceCtx.close();
    await hostCtx.close();
  });

  // ── Phase 5: Session end + recap ──────────────────────────────────────────

  test("Phase 5 — host ends session, both sides see completion", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.lockedTickets = ["ticket-1", "ticket-2", "ticket-3"];
    for (const m of MEMBERS) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });

    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    await openAlice(alicePage);
    await openHost(hostPage);

    // Host clicks "End Session"
    const endBtn = hostPage.getByRole("button", { name: "End Session" });
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    await wsServer.waitForMessage("END_SESSION");

    // Host sees Session Complete recap
    await expect(hostPage.getByText("Session Complete")).toBeVisible({ timeout: 5000 });

    // Participant sees Session Ended overlay
    await expect(alicePage.getByText("Session Ended")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("The host has ended this refinement session.")).toBeVisible();

    await hostCtx.close();
    await aliceCtx.close();
  });

  // ── Full lifecycle in one test ────────────────────────────────────────────

  test("Full 8-member lifecycle: check-in → 3 tickets → end", async ({ browser }) => {
    const hostCtx  = await browser.newContext();
    const aliceCtx = await browser.newContext();
    const hostPage  = await hostCtx.newPage();
    const alicePage = await aliceCtx.newPage();

    // ── Lobby ────────────────────────────────────────────────────────────────
    await openAlice(alicePage);
    await openHost(hostPage);

    // Check in all 8 members via WS broadcast
    for (const m of MEMBERS) {
      wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });
      wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });
    }
    await expect(hostPage.getByRole("button", { name: /Start session/i })).toBeEnabled({ timeout: 5000 });
    await expect(hostPage.getByText("8/3")).toBeVisible({ timeout: 5000 });

    // Host starts session
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.broadcast({ type: "SESSION_STARTED" });
    await expect(hostPage.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });

    // ── Ticket loop ──────────────────────────────────────────────────────────
    for (const t of TICKETS) {
      // Reset per-round state
      wsServer.state.votes = {};
      wsServer.state.revealed = false;
      wsServer.state.revealedVotes = null;

      // Open ticket
      wsServer.state.currentTicket = { ticketId: t.ticketId, jiraKey: t.jiraKey, title: t.title, ...(t.contextNote ? { contextNote: t.contextNote } : {}) };
      wsServer.broadcast({ type: "TICKET_OPENED", ...wsServer.state.currentTicket, description: t.description, issueType: t.issueType, priority: t.priority });

      await expect(alicePage.getByText(t.jiraKey)).toBeVisible({ timeout: 5000 });
      await expect(alicePage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

      // Alice votes via UI
      await alicePage.locator("button").filter({ hasText: new RegExp(`^${t.aliceVote}$`) }).click();
      const vote = await wsServer.waitForMessage("VOTE_CAST");
      expect(vote.value).toBe(t.aliceVote);

      // Other 7 vote via injected state
      injectOtherVotes(wsServer, t);
      await expect(hostPage.getByText("8/8")).toBeVisible({ timeout: 5000 });

      // Reveal
      const allVotes = MEMBERS.map((m) => ({
        memberId: m.id,
        memberName: m.name,
        value: m.id === "member-alice" ? t.aliceVote : (t.votes[m.id as keyof typeof t.votes] as number),
      }));
      wsServer.state.revealed = true;
      wsServer.state.revealedVotes = allVotes;
      wsServer.broadcast({ type: "VOTES_REVEALED", votes: allVotes, median: t.expectedMedian, isConsensus: t.expectedConsensus });

      await expect(alicePage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
      if (t.expectedConsensus) {
        await expect(alicePage.getByText("Consensus")).toBeVisible({ timeout: 5000 });
      } else {
        await expect(alicePage.getByText("Consensus")).not.toBeVisible();
      }

      // Lock
      wsServer.state.lockedTickets.push(t.ticketId);
      wsServer.state.currentTicket = null;
      wsServer.state.votes = {};
      wsServer.state.revealed = false;
      wsServer.state.revealedVotes = null;
      wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: t.ticketId, value: t.expectedMedian });

      await expect(alicePage.getByText("Waiting for host")).toBeVisible({ timeout: 6000 });

      // Reset WS message queue between rounds so waitForMessage works fresh
      wsServer.reset();
      wsServer.state.sessionStatus = "ACTIVE";
      wsServer.state.lockedTickets = TICKETS.slice(0, TICKETS.indexOf(t) + 1).map((x) => x.ticketId);
      for (const m of MEMBERS) wsServer.state.checkedIn.push({ memberId: m.id, memberName: m.name, role: m.role });
    }

    // ── End session ──────────────────────────────────────────────────────────
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
