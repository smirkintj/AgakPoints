/**
 * HostView tests — host session control panel
 * Uses /test-fixtures/host with a real TestWsServer on port 1999.
 */

import { test, expect } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

const FIXTURE_URL = "/test-fixtures/host";

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
  await mockSessionApis(page);
});

test.describe("HostView — WAITING state", () => {
  test("shows sprint name in header with WAITING badge", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Sprint 42")).toBeVisible();
    await expect(page.getByText("WAITING", { exact: true }).first()).toBeVisible();
  });

  test("shows 'Waiting for team' message", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Waiting for team")).toBeVisible();
  });

  test("shows all 3 tickets in the sidebar", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("PROJ-101")).toBeVisible();
    await expect(page.getByText("PROJ-102")).toBeVisible();
    await expect(page.getByText("PROJ-103")).toBeVisible();
  });

  test("Start Session button is disabled with 0 checked-in members", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    const startBtn = page.getByRole("button", { name: /Start session/ });
    await expect(startBtn).toBeDisabled();
  });

  test("Start Session button enables after member checks in", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.state.checkedIn = [{ memberId: "member-alice", memberName: "Alice Dev", role: "DEV" }];
    wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });

    await expect(page.getByRole("button", { name: /Start session/ })).toBeEnabled({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /1 checked in/ })).toBeVisible();
  });

  test("clicking Start Session sends START_SESSION and transitions to ACTIVE", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.state.checkedIn = [{ memberId: "member-alice", memberName: "Alice Dev", role: "DEV" }];
    wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });

    await page.getByRole("button", { name: /Start session/ }).click();

    await wsServer.waitForMessage("START_SESSION");
    await expect(page.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });
  });

  test("member counter shows X/3 in the header", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.state.checkedIn = [
      { memberId: "member-alice", memberName: "Alice Dev", role: "DEV" },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
    wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });

    await expect(page.getByText("2/3")).toBeVisible({ timeout: 5000 });
  });

  test("Share link button is visible", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Share link")).toBeVisible();
  });
});

test.describe("HostView — ACTIVE state", () => {
  test.beforeEach(() => {
    wsServer.state.sessionStatus = "ACTIVE";
    wsServer.state.checkedIn = [
      { memberId: "member-alice", memberName: "Alice Dev", role: "DEV" },
      { memberId: "member-bob", memberName: "Bob QA", role: "QA" },
    ];
  });

  test("shows ACTIVE badge when session is active", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("ACTIVE")).toBeVisible({ timeout: 5000 });
  });

  test("shows instruction to select ticket from sidebar", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Select a ticket from the sidebar to start voting")).toBeVisible({ timeout: 5000 });
  });

  test("shows 'End Session' button when ACTIVE", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.getByRole("button", { name: "End Session" })).toBeVisible({ timeout: 5000 });
  });

  test("VOTE_PROGRESS updates the vote counter", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({
      type: "VOTE_PROGRESS",
      votedCount: 1,
      totalCount: 2,
      votedMemberIds: ["member-alice"],
    });

    await expect(page.getByText(/1\/2/)).toBeVisible({ timeout: 5000 });
  });

  test("Reveal button appears and sends REVEAL_VOTES", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };
    wsServer.state.votes = { "member-alice": 5 };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    // Broadcast vote progress so Reveal button becomes enabled (votedCount > 0)
    wsServer.broadcast({
      type: "VOTE_PROGRESS",
      votedCount: 1,
      totalCount: 2,
      votedMemberIds: ["member-alice"],
    });

    const revealBtn = page.getByRole("button", { name: /Reveal votes/i });
    await expect(revealBtn).toBeVisible({ timeout: 5000 });
    await expect(revealBtn).toBeEnabled();
    await revealBtn.click();

    await wsServer.waitForMessage("REVEAL_VOTES");
  });

  test("shows revealed votes and median after VOTES_REVEALED", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [
        { memberId: "member-alice", memberName: "Alice Dev", value: 5 },
        { memberId: "member-bob", memberName: "Bob QA", value: 8 },
      ],
      median: 7,
      isConsensus: false,
    });

    await expect(page.getByText("Revealed")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Median/)).toBeVisible();
    await expect(page.locator("text=7").first()).toBeVisible();
  });

  test("host selects estimate and locks it", async ({ page }) => {
    wsServer.state.currentTicket = { ticketId: "ticket-1", jiraKey: "PROJ-101", title: "Implement user authentication" };
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({
      type: "VOTES_REVEALED",
      votes: [{ memberId: "member-alice", memberName: "Alice Dev", value: 5 }],
      median: 5,
      isConsensus: true,
    });

    await expect(page.getByText("Lock estimate")).toBeVisible({ timeout: 5000 });

    // Click the 5-point card in the lock estimate section
    await page.locator("button").filter({ hasText: /^5$/ }).last().click();

    const lockBtn = page.getByRole("button", { name: /Lock/ });
    await expect(lockBtn).toBeEnabled();
    await lockBtn.click();

    await wsServer.waitForMessage("LOCK_ESTIMATE");
  });

  test("End Session button sends END_SESSION and shows Session Complete recap", async ({ page }) => {
    await page.goto(FIXTURE_URL);

    const endBtn = page.getByRole("button", { name: "End Session" });
    await expect(endBtn).toBeVisible({ timeout: 5000 });
    await endBtn.click();

    await wsServer.waitForMessage("END_SESSION");
    await expect(page.getByText("Session Complete")).toBeVisible({ timeout: 5000 });
  });

  test("locked ticket moves to Estimated section in sidebar", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    wsServer.broadcast({ type: "ESTIMATE_LOCKED", ticketId: "ticket-1", value: 5 });

    await expect(page.getByText("Estimated")).toBeVisible({ timeout: 5000 });
  });
});
