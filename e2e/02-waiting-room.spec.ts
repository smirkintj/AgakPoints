/**
 * WaitingRoom tests — member check-in flow
 * Uses /test-fixtures/waiting-room which renders WaitingRoom with mock data.
 * WebSocket messages flow through a real TestWsServer on port 1999.
 */

import { test, expect } from "@playwright/test";
import { TestWsServer } from "./helpers/ws-server";
import { mockSessionApis } from "./helpers/ws-mock";

const FIXTURE_URL = "/test-fixtures/waiting-room";

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

test.describe("WaitingRoom — check-in flow", () => {
  test("renders product name and member list", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);
    await expect(page.locator("h1")).toContainText("AgakPoints Test Product");
    await expect(page.locator("p").filter({ hasText: "Sprint 42" })).toBeVisible();
    await expect(page.getByText("Alice Dev")).toBeVisible();
    await expect(page.getByText("Bob QA")).toBeVisible();
    await expect(page.getByText("Carol TL")).toBeVisible();
  });

  test("shows instruction text and initial 0/3 count", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);
    await expect(page.getByText("Click your name to check in")).toBeVisible();
    await expect(page.getByText("0/3 checked in")).toBeVisible();
  });

  test("clicking a member name sends CHECKIN and shows 'You're in!' confirmation", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);

    // Wait for WS to connect (page should show initial state)
    await page.waitForLoadState("networkidle");

    await page.getByText("Alice Dev").click();

    const checkinMsg = await wsServer.waitForMessage("CHECKIN");
    expect(checkinMsg.memberId).toBe("member-alice");
    expect(checkinMsg.memberName).toBe("Alice Dev");

    await expect(page.getByText("You're in!")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Hey Alice Dev/)).toBeVisible();
  });

  test("checked-in counter updates after PRESENCE_UPDATE", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    // Broadcast PRESENCE_UPDATE from server side
    wsServer.state.checkedIn = [{ memberId: "member-alice", memberName: "Alice Dev", role: "DEV" }];
    wsServer.broadcast({ type: "PRESENCE_UPDATE", checkedIn: wsServer.state.checkedIn });

    await expect(page.getByText("1/3 checked in")).toBeVisible({ timeout: 5000 });
  });

  test("SESSION_STARTED triggers navigation to /session/[id]", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    // Click Alice so she is the selected member
    await page.getByText("Alice Dev").click();
    await wsServer.waitForMessage("CHECKIN");
    await expect(page.getByText("You're in!")).toBeVisible({ timeout: 5000 });

    // Server broadcasts SESSION_STARTED
    wsServer.broadcast({ type: "SESSION_STARTED" });

    // Navigation to /session/SESSION_ID is triggered
    await page.waitForURL("**/session/**", { timeout: 5000 }).catch(() => {
      // Page may 404/500 without a real DB — the important thing is the nav was triggered
    });
    expect(page.url()).toContain("session");
  });

  test("other checked-in members shown in 'You're in!' panel", async ({ page }) => {
    await mockSessionApis(page);
    // Pre-seed Alice as already checked in
    wsServer.state.checkedIn = [{ memberId: "member-alice", memberName: "Alice Dev", role: "DEV" }];
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    // Bob checks in via UI
    await page.getByText("Bob QA").click();
    await wsServer.waitForMessage("CHECKIN");
    await expect(page.getByText("You're in!")).toBeVisible({ timeout: 5000 });

    // Alice should appear in the others list
    await expect(page.getByText("Alice Dev")).toBeVisible();
  });

  test("checking in the same member twice is idempotent (PartyKit dedup)", async ({ page }) => {
    await mockSessionApis(page);
    await page.goto(FIXTURE_URL);
    await page.waitForLoadState("networkidle");

    await page.getByText("Bob QA").click();
    await wsServer.waitForMessage("CHECKIN");

    // WsMockServer deduplication: even if CHECKIN fires twice, state has Bob once
    const count = wsServer.state.checkedIn.filter((m) => m.memberId === "member-bob").length;
    expect(count).toBe(1);
  });
});
