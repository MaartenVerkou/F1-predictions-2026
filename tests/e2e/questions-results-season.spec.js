"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");
const { ensureSeasonInputsSchema } = require("../../src/season-inputs");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

test("Questions and Results share one season selector", async ({ page }) => {
  const db = new Database(DB_PATH);
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO seasons (year, label, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(2026, "2026", "active", now, now);
  db.prepare(
    `INSERT OR IGNORE INTO seasons (year, label, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(2027, "2027", "planned", now, now);
  db.close();

  await page.goto("/admin/questions?season=2026&view=questions");
  const season = page.locator("[data-admin-questions-season-form] select[name=season]");
  await expect(season).toHaveValue("2026");
  await expect(page.locator(".admin-questions-view-toggle .is-active")).toHaveText("Questions");
  await expect(page.locator("[data-question-order-row]").first()).toBeVisible();

  await page.goto("/admin/questions?season=2026&view=results");
  await expect(page.locator("[data-admin-questions-season-form] select[name=season]")).toHaveValue("2026");
  await expect(page.locator(".admin-questions-view-toggle .is-active")).toHaveText("Results");
  await expect(page.getByRole("heading", { name: "Question results" })).toBeVisible();

  await page.locator("[data-admin-questions-season-form] select[name=season]").selectOption("2027");
  await page.waitForURL(/\/admin\/questions\?view=results&season=2027/);
  await expect(page.locator("[data-admin-questions-season-form] select[name=season]")).toHaveValue("2027");
  await expect(page.locator(".admin-questions-view-toggle .is-active")).toHaveText("Results");
});
