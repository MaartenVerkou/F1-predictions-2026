"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");
const { ensureSeasonInputsSchema } = require("../../src/season-inputs");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

test("Questions and Results use separate season-aware pages", async ({ page }) => {
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

  await page.goto("/admin/questions?season=2026");
  const season = page.locator("[data-admin-questions-season-form] select[name=season]");
  await expect(season).toHaveValue("2026");
  await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();
  await expect(page.locator(".admin-actuals-overview-table")).toHaveCount(0);
  await expect(page.locator("[data-question-order-row]").first()).toBeVisible();

  await page.goto("/admin/results?season=2026");
  await expect(page.locator("[data-admin-results-season-form] select[name=season]")).toHaveValue("2026");
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(page.locator(".admin-actuals-overview-table")).toBeVisible();

  await page.locator("[data-admin-results-season-form] select[name=season]").selectOption("2027");
  await page.waitForURL(/\/admin\/results\?season=2027/);
  await expect(page.locator("[data-admin-results-season-form] select[name=season]")).toHaveValue("2027");
});

test("admin season selectors and edit actions share the compact control geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  const measurements = {};
  for (const [pageName, url, selector] of [
    ["questions", "/admin/questions?season=2026", "[data-admin-questions-season-form] select[name=season]"],
    ["results", "/admin/results?season=2026", "[data-admin-results-season-form] select[name=season]"],
    ["inputs", "/admin/inputs?season=2026", "#admin-inputs-season"],
    ["raceData", "/admin/race-data?season=2026", "#admin-race-data-season"]
  ]) {
    await page.goto(url);
    const rect = await page.locator(selector).boundingBox();
    measurements[pageName] = { width: Math.round(rect.width), height: Math.round(rect.height) };
  }

  const selectorWidths = Object.values(measurements).map((value) => value.width);
  expect(new Set(selectorWidths).size).toBe(1);
  expect(measurements.questions.height).toBe(measurements.results.height);
  expect(measurements.inputs.height).toBe(measurements.raceData.height);

  await page.goto("/admin/questions?season=2026");
  const editButton = await page.locator(".admin-question-edit-button").boundingBox();
  expect(Math.round(editButton.height)).toBe(34);
});
