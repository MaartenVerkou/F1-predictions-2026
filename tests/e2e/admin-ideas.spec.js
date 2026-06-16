"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");
const SEEDED_TIME_PENALTIES_TITLE =
  "Voorspel de totale hoeveelheid time penalties die in het seizoen uitgedeeld worden.";

function resetAdminIdeas() {
  const db = new Database(DB_PATH);
  db.prepare("DELETE FROM admin_ideas WHERE seed_key IS NULL").run();
  db.prepare(
    `
    UPDATE admin_ideas
    SET status = 'open',
        updated_at = created_at,
        updated_by_user_id = created_by_user_id
    WHERE seed_key = 'next-year-time-penalties-question'
    `
  ).run();
  db.close();
}

test("admin ideas page seeds ideas and supports todo-style triage", async ({ page }) => {
  await page.goto("/");
  resetAdminIdeas();

  await page.goto("/admin/ideas");
  await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Admin navigation" }).getByRole("link", { name: "Ideas" })
  ).toHaveClass(/is-active/);

  const seededRow = page.locator(".admin-idea-row", {
    hasText: SEEDED_TIME_PENALTIES_TITLE
  });
  await expect(seededRow).toBeVisible();
  await expect(seededRow).toContainText("Question");
  await expect(seededRow).toContainText("Open");

  await page.getByLabel("Type").selectOption("feature");
  await page.getByLabel("Idea").fill("Add off-season idea review dashboard");
  await page.getByLabel("Notes").fill("Useful before freezing next year's question list.");
  await page.getByRole("button", { name: "Add idea" }).click();

  await expect(page.getByText("Idea added.")).toBeVisible();
  const featureRow = page.locator(".admin-idea-row", {
    hasText: "Add off-season idea review dashboard"
  });
  await expect(featureRow).toContainText("Feature");
  await expect(featureRow).toContainText("Open");
  await expect(featureRow).toContainText("Useful before freezing next year's question list.");

  await featureRow.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Idea status updated.")).toBeVisible();
  await expect(featureRow).toContainText("Resolved");
  await expect(featureRow).toContainText("Reopen");

  await featureRow.getByRole("button", { name: "Reopen" }).click();
  await expect(featureRow).toContainText("Open");

  await featureRow.getByRole("button", { name: "Ignore" }).click();
  await expect(featureRow).toContainText("Ignored");
  await expect(featureRow).toContainText("Reopen");
});

test("admin ideas page is admin-only and fits supported viewports", async ({ page }) => {
  await page.goto("/");
  resetAdminIdeas();

  await page.getByRole("button", { name: "Visitor" }).click();
  await page.goto("/admin/ideas");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Admin" }).click();

  const cases = [
    { width: 390, height: 844, theme: "light" },
    { width: 390, height: 844, theme: "dark" },
    { width: 1280, height: 900, theme: "light" },
    { width: 1280, height: 900, theme: "dark" }
  ];

  for (const testCase of cases) {
    await page.setViewportSize({ width: testCase.width, height: testCase.height });
    await page.goto("/admin/ideas");
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }, testCase.theme);

    await expect(page.getByRole("heading", { name: "Ideas", exact: true })).toBeVisible();
    await expect(page.locator(".admin-idea-row", { hasText: SEEDED_TIME_PENALTIES_TITLE })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      overflowX: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth
      ),
      rows: document.querySelectorAll(".admin-idea-row").length,
      formWidth: Math.round(document.querySelector(".admin-idea-form").getBoundingClientRect().width),
      maxActionRight: Array.from(document.querySelectorAll(".admin-idea-actions")).reduce(
        (max, actions) => Math.max(max, Math.round(actions.getBoundingClientRect().right)),
        0
      )
    }));

    expect(metrics.theme).toBe(testCase.theme);
    expect(metrics.overflowX).toBeLessThanOrEqual(0);
    expect(metrics.rows).toBeGreaterThan(0);
    expect(metrics.formWidth).toBeLessThanOrEqual(testCase.width);
    expect(metrics.maxActionRight).toBeLessThanOrEqual(testCase.width);
  }
});
