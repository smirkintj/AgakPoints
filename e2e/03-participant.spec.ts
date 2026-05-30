/**
 * ParticipantView tests — voting UI
 * Uses /test-fixtures/participant.
 * Member identity is injected via addInitScript (sessionStorage).
 * WebSocket messages flow through a real TestWsServer on port 1999.
 */

import { test, expect } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

const FIXTURE_URL = "/test-fixtures/participant";
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

test.beforeEach(async ({ page }) => {
  wsServer.reset();
  wsServer.state.sessionStatus = "ACTIVE";
  wsServer.state.checkedIn = [
    { memberId: "member-alice", memberName: "Alice Dev", role: "DEV" },
    { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
  ];

  await mockSessionApis(page);
  await page.addInitScript(
    ([sessionId, member]) => {
      sessionStorage.setItem(`agakpoints_member_${sessionId}`, JSON.stringify(member));
    },
    [SESSION_ID, ALICE]
  );
});

test.describe("ParticipantView", () => {
  test("shows 'Waiting for host' when no ticket is open", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Waiting for host")).toBeVisible();
    await expect(page.getByText("The host will open a ticket to vote on.")).toBeVisible();
  });

  test("shows ticket when TICKET_OPENED arrives", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Waiting for host")).toBeVisible();

    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: "ticket-1",
      jiraKey: "PROJ-101",
      title: "Implement user authentication",
      description: "Setup NextAuth credentials provider",
      issueType: "Story",
      priority: "High",
    });

    await expect(page.getByText("PROJ-101")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Implement user authentication")).toBeVisible();
  });

  test("shows all Fibonacci voting cards", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Auth ticket" };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });
    for (const value of [1, 2, 3, 5, 8, 13, 21]) {
      await expect(page.locator(`button`).filter({ hasText: new RegExp(`^${value}$`) }).first()).toBeVisible();
    }
  });

  test("selecting a card sends VOTE_CAST and disables further selection", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Auth ticket" };
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    await page.locator("button").filter({ hasText: /^5$/ }).click();

    const voteMsg = await wsServer.waitForMessage("VOTE_CAST");
    expect(voteMsg.value).toBe(5);
    expect(voteMsg.memberId).toBe("member-alice");

    await expect(page.getByText(/You voted 5/)).toBeVisible({ timeout: 5000 });
  });

  test("shows revealed votes and median after VOTES_REVEALED", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Auth ticket" };
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    // Alice votes
    await page.locator("button").filter({ hasText: /^5$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");

    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [
        { memberId: "member-alice", memberName: "Alice Dev", value: 5 },
        { memberId: "member-bob", memberName: "Bob QA", value: 8 },
      ],
      median: 7,
      isConsensus: false,
    });

    await expect(page.getByText(/Median/)).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=7").first()).toBeVisible();
  });

  test("VOTES_REVEALED with consensus shows 'Consensus' badge", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Auth ticket" };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [
        { memberId: "member-alice", memberName: "Alice Dev", value: 5 },
        { memberId: "member-bob", memberName: "Bob QA", value: 5 },
      ],
      median: 5,
      isConsensus: true,
    });

    await expect(page.getByText("Consensus")).toBeVisible({ timeout: 5000 });
  });

  test("ESTIMATE_LOCKED clears the current ticket (React 18 batching: both setters fire in one render)", async ({ page }) => {
    // ParticipantView handles ESTIMATE_LOCKED by calling setLockedTickets AND setCurrentTicket(null)
    // React 18 batches these into a single render, so the locked text inside the
    // currentTicket block is never visible — the UI jumps straight to "Waiting for host".
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Auth ticket" };
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Auth ticket")).toBeVisible({ timeout: 5000 });

    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: "ticket-1", value: 5 });

    // Ticket is cleared; participant waits for the next one
    await expect(page.getByText("Waiting for host")).toBeVisible({ timeout: 5000 });
  });

  test("SESSION_ENDED shows overlay with 'Session Ended'", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({ type: "SESSION_ENDED" });

    await expect(page.getByText("Session Ended")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("The host has ended this refinement session.")).toBeVisible();
  });

  test("shows 'Who are you?' when no member in sessionStorage", async ({ page }) => {
    // Override the beforeEach init script to clear sessionStorage
    await page.addInitScript(([id]) => {
      sessionStorage.removeItem(`agakpoints_member_${id}`);
    }, [SESSION_ID]);

    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Who are you?")).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`a[href="/join/${SESSION_ID}"]`)).toBeVisible();
  });

  test("shows context note from host", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: "ticket-1",
      jiraKey: "PROJ-101",
      title: "Auth ticket",
      contextNote: "Focus on OWASP top 10 security compliance",
    });

    await expect(page.getByText("Host notes")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Focus on OWASP top 10 security compliance")).toBeVisible();
  });

  test("new TICKET_OPENED resets vote state", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "First ticket" };
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Pick your estimate")).toBeVisible({ timeout: 5000 });

    await page.locator("button").filter({ hasText: /^5$/ }).click();
    await wsServer.waitForMessage("VOTE_CAST");
    await expect(page.getByText(/You voted 5/)).toBeVisible({ timeout: 3000 });

    // Host opens next ticket
    wsServer.broadcast({
      type: "TICKET_OPENED",
      ticketId: "ticket-2",
      jiraKey: "PROJ-102",
      title: "Second ticket — fresh round",
    });

    await expect(page.getByText("Second ticket — fresh round")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pick your estimate")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(/You voted 5/)).not.toBeVisible();
  });
});
