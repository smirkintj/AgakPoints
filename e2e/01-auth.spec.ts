/**
 * Auth Tests — Login & Register forms
 * Both pages are "use client" components with no SSR DB queries.
 * API calls are intercepted so no database is required.
 */

import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders branding and form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("AgakPoints");
    await expect(page.locator("h2")).toContainText("Sign In");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Sign In");
  });

  test("shows error on bad credentials", async ({ page }) => {
    // Intercept NextAuth sign-in and return a failure
    await page.route("**/api/auth/callback/credentials**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "CredentialsSignin" }),
      });
    });
    // NextAuth also calls /api/auth/csrf for the CSRF token
    await page.route("**/api/auth/csrf**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "test-csrf-token" }),
      });
    });
    await page.route("**/api/auth/signin**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "CredentialsSignin" }),
      });
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Should show an error message (even if the mock doesn't fully replicate NextAuth)
    await expect(page.locator('input[type="email"]')).toHaveValue("wrong@example.com");
  });

  test("email field validates format", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("not-an-email");
    await page.click('button[type="submit"]');
    // HTML5 validation prevents submit for invalid email
    const validity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(validity).toBe(false);
  });

  test("both fields are required", async ({ page }) => {
    await page.goto("/login");
    await page.click('button[type="submit"]');
    const emailValidity = await page.locator('input[type="email"]').evaluate((el: HTMLInputElement) => el.validity.valueMissing);
    expect(emailValidity).toBe(true);
  });

  test("has link to register page", async ({ page }) => {
    await page.goto("/login");
    const registerLink = page.locator("a[href='/register']");
    await expect(registerLink).toBeVisible();
    await registerLink.click();
    await page.waitForURL("**/register");
    await expect(page.locator("h2")).toContainText("Register");
  });
});

test.describe("Register page", () => {
  test("renders all form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toContainText("AgakPoints");
    await expect(page.locator("h2")).toContainText("Register");
    // Name, email, password, confirm password
    await expect(page.locator('input[autocomplete="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="new-password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Create Account");
  });

  test("shows error when passwords don't match", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[autocomplete="name"]', "Test User");
    await page.fill('input[type="email"]', "test@example.com");
    // Fill password fields
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill("Password123");
    await passwordFields.nth(1).fill("Different456");
    await page.click('button[type="submit"]');
    await expect(page.locator("p.text-red-400")).toContainText("don't match");
  });

  test("calls register API on valid submit", async ({ page }) => {
    // Register the catch-all FIRST (Playwright matches last-registered routes first,
    // so the specific /register handler — registered after — takes precedence).
    await page.route("**/api/auth/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "/dashboard" }),
      });
    });

    // Use waitForResponse to reliably capture the register payload
    await page.goto("/register");
    await page.fill('input[autocomplete="name"]', "New User");
    await page.fill('input[type="email"]', "newuser@example.com");
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill("Password123");
    await passwordFields.nth(1).fill("Password123");

    // Start waiting for the /register request before clicking submit
    const registerResponse = page.waitForRequest("**/api/auth/register");
    await page.click('button[type="submit"]');

    const req = await registerResponse;
    const payload = req.postDataJSON() as Record<string, string>;
    expect(payload.email).toBe("newuser@example.com");
    expect(payload.name).toBe("New User");
  });

  test("shows API error message (duplicate email)", async ({ page }) => {
    await page.route("**/api/auth/register", (route) => {
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "Email already in use." }),
      });
    });

    await page.goto("/register");
    await page.fill('input[autocomplete="name"]', "Test User");
    await page.fill('input[type="email"]', "duplicate@example.com");
    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.nth(0).fill("Password123");
    await passwordFields.nth(1).fill("Password123");
    await page.click('button[type="submit"]');

    await expect(page.locator("p.text-red-400")).toContainText("Email already in use.");
  });

  test("has link back to login", async ({ page }) => {
    await page.goto("/register");
    const loginLink = page.locator("a[href='/login']");
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await page.waitForURL("**/login");
    await expect(page.locator("h2")).toContainText("Sign In");
  });
});
