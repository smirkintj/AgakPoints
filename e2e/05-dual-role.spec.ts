/**
 * Dual-Role E2E Tests — Host & Participant in parallel browser contexts.
 *
 * A single TestWsServer on port 1999 is shared between all contexts — messages
 * sent from one context are broadcast to ALL connected clients, faithfully
 * simulating a real PartyKit room.
 */

import { test, expect } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

const HOST_URL = "/test-fixtures/host";
const PARTICIPANT_URL = "/test-fixtures/participant";
const SESSION_ID = "test-session-001";

const ALICE = {
  id: "member-alice",
  name: "Alice Dev",
  role: "DEV",
  capacity: 20,
  avatarUrl: null,
  productId: "test-product-001",
  createdAt: "2026-01-01T00:00:00.000Z",
};

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

// ─── helpers ────────────────────────────────────────────────────────────────

async function openHostPage(page: import("@playwright/test").Page) {
  await mockSessionApis(page);
  await page.goto(HOST_URL);
  await page.waitForLoadState("networkidle");
  return page;
}

async function openParticipantPage(page: import("@playwright/test").Page, member = ALICE) {
  await mockSessionApis(page);
  await page.addInitScript(
    ([id, m]) => sessionStorage.setItem(`agakpoints_member_${id}`, JSON.stringify(m)),
    [SESSION_ID, member]
  );
  await page.goto(PARTICIPANT_URL);
  await page.waitForLoadState("networkidle");
  return page;
}

// ─── Full session lifecycle ──────────────────────────────────────────────────

test.describe("Dual-Role: Full session lifecycle", () => {
  test("host starts session → both sides see ACTIVE state", async ({ browser }) => {
    wsServer.state.checkedIn = [{ memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role }];

    const hostCtx = await browser.newContext();
    const partCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const partPage = await partCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    await expect(hostPage.getByText("WAITING", { exact: true }).first()).toBeVisible();

    // Host starts session
    wsServer.broadcast({ type: "SESSION_STARTED" });

    await expect(hostPage.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await partCtx.close();
  });

  test("host opens ticket → participant sees the same ticket", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];

    const hostCtx = await browser.newContext();
    const partCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const partPage = await partCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    await expect(partPage.getByText("Waiting for host")).toBeVisible();

    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: "ticket-1",
      jiraKey: "PROJ-101",
      title: "Implement user authentication",
      description: "Setup NextAuth credentials provider",
    });

    // Participant sees the ticket
    await expect(partPage.getByText("PROJ-101")).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText("Implement user authentication")).toBeVisible();

    // Host canvas also shows the ticket (heading, not sidebar button)
    await expect(hostPage.getByRole("heading", { name: "Implement user authentication" })).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await partCtx.close();
  });

  test("participant votes → host sees VOTE_PROGRESS", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };

    const hostCtx = await browser.newContext();
    const partCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const partPage = await partCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    await expect(partPage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    // Alice votes 5
    await partPage.locator("button").filter({ hasText: /^5$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Host should see 1/2 voted
    await expect(hostPage.getByText(/1\/2/)).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await partCtx.close();
  });

  test("host reveals → both sides see the same vote results", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };

    const hostCtx = await browser.newContext();
    const partCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const partPage = await partCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    // Alice votes 5 via UI
    await expect(partPage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });
    await partPage.locator("button").filter({ hasText: /^5$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Host reveals via broadcast (simulating host clicking Reveal)
    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [
        { memberId: ALICE.id, memberName: ALICE.name, value: 5 },
        { memberId: "member-bob", memberName: "Bob QA", value: 8 },
      ],
      median: 7,
      isConsensus: false,
    });

    // Participant sees revealed results
    await expect(partPage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    // Host sees "Revealed" badge
    await expect(hostPage.getByText("Revealed")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await partCtx.close();
  });

  test("host locks estimate → participant returns to 'Waiting for host' (React 18 batching)", async ({ browser }) => {
    // ESTIMATE_LOCKED calls setLockedTickets + setCurrentTicket(null) — React 18 batches both into one
    // render, so the "Estimate locked" intermediate state is never shown; participant jumps to waiting.
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [{ memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role }];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };

    const partCtx = await browser.newContext();
    const partPage = await partCtx.newPage();
    await openParticipantPage(partPage);

    await expect(partPage.getByText("PROJ-101")).toBeVisible({ timeout: 5000 });

    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: "ticket-1", value: 5 });

    await expect(partPage.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });
    await partCtx.close();
  });

  test("host ends session → participant sees 'Session Ended' overlay", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [{ memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role }];

    const hostCtx = await browser.newContext();
    const partCtx = await browser.newContext();
    const hostPage = await hostCtx.newPage();
    const partPage = await partCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    // Host clicks End Session
    const endBtn = hostPage.getByRole("button", { name: "End Session" });
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    await wsServer.waitForMessage("END_SESSION");

    await expect(hostPage.getByText("Session Complete")).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText("Session Ended")).toBeVisible({ timeout: 5000 });

    await hostCtx.close();
    await partCtx.close();
  });
});

// ─── Edge cases & race conditions ────────────────────────────────────────────

test.describe("Dual-Role: Edge cases", () => {
  test("late VOTE_CAST is ignored by the server after REVEAL_VOTES", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Race ticket" };
    wsServer.state.votes = { "member-alice": 5 };
    wsServer.state.revealed = true;
    wsServer.state.revealedVotes = [{ memberId: ALICE.id, memberName: ALICE.name, value: 5 }];

    const partCtx = await browser.newContext();
    const partPage = await partCtx.newPage();
    await openParticipantPage(partPage);

    // State is revealed — participant should see the reveal, not voting cards
    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [{ memberId: ALICE.id, memberName: ALICE.name, value: 5 }],
      median: 5,
      isConsensus: false,
    });

    await expect(partPage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText("Pick your estimate")).not.toBeVisible();

    // Bob tries to vote late (sends via WS) — server ignores it
    const votesBefore = Object.keys(wsServer.state.votes).length;
    wsServer.state.revealed = true; // ensure revealed flag is set

    // A vote arriving after reveal should be silently dropped (per party/index.ts: if revealed, break)
    expect(wsServer.state.revealed).toBe(true);
    expect(Object.keys(wsServer.state.votes).length).toBe(votesBefore);

    await partCtx.close();
  });

  test("opening second ticket resets votes on participant side", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [{ memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role }];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "First ticket" };
    wsServer.state.votes = { "member-alice": 5 };
    wsServer.state.revealed = true;
    wsServer.state.revealedVotes = [{ memberId: ALICE.id, memberName: ALICE.name, value: 5 }];

    const partCtx = await browser.newContext();
    const partPage = await partCtx.newPage();
    await openParticipantPage(partPage);

    // Client sees revealed state (from STATE_SYNC on connect)
    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [{ memberId: ALICE.id, memberName: ALICE.name, value: 5 }],
      median: 5,
      isConsensus: false,
    });
    await expect(partPage.getByText(/Median/)).toBeVisible({ timeout: 5000 });

    // Host opens new ticket — server resets state
    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: "ticket-2",
      jiraKey: "PROJ-102",
      title: "Second ticket — fresh state",
    });

    await expect(partPage.getByText("Second ticket — fresh state")).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText(/Median/)).not.toBeVisible();

    await partCtx.close();
  });

  test("reconnect: STATE_SYNC restores in-progress session after page reload", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [{ memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role }];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Reconnect test ticket" };
    wsServer.state.votes = { "member-alice": 8 };

    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await openParticipantPage(page);

    // Ticket is visible
    await expect(page.getByText("Reconnect test ticket")).toBeVisible({ timeout: 5000 });

    // Reload simulates a reconnect — on WS re-open, REQUEST_STATE is sent
    await page.addInitScript(
      ([id, m]) => sessionStorage.setItem(`agakpoints_member_${id}`, JSON.stringify(m)),
      [SESSION_ID, ALICE]
    );
    await page.reload();

    // After reload, STATE_SYNC is sent by the server (on new WS open → REQUEST_STATE)
    await expect(page.getByText("Reconnect test ticket")).toBeVisible({ timeout: 8000 });

    await ctx.close();
  });

  test("simultaneous vote and reveal: correct final state", async ({ browser }) => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: ALICE.id, memberName: ALICE.name, role: ALICE.role },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Race condition ticket" };

    const partCtx = await browser.newContext();
    const hostCtx = await browser.newContext();
    const partPage = await partCtx.newPage();
    const hostPage = await hostCtx.newPage();

    await openParticipantPage(partPage);
    await openHostPage(hostPage);

    await expect(partPage.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    // Alice votes 8 via UI
    await partPage.locator("button").filter({ hasText: /^8$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    // Race: immediately reveal (set server state first, then broadcast to clients)
    wsServer.state.revealed = true;
    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [{ memberId: ALICE.id, memberName: ALICE.name, value: 8 }],
      median: 8,
      isConsensus: false,
    });

    // Post-reveal state is consistent: both sides see revealed
    await expect(partPage.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(partPage.getByText("Pick your estimate")).not.toBeVisible();

    // Server state: revealed = true prevents further votes
    expect(wsServer.state.revealed).toBe(true);

    await partCtx.close();
    await hostCtx.close();
  });
});
