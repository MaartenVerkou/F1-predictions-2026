"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

test("admin actuals shows the derived question matrix while Race Data owns review", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  db.exec(`
    DELETE FROM actual_snapshot_values;
    DELETE FROM actual_snapshots;
    DELETE FROM published_actual_sets;
    DELETE FROM actuals;
  `);
  const snapshotResult = db.prepare(
    `
    INSERT INTO actual_snapshots (
      season,
      round_number,
      round_name,
      label,
      source_type,
      source_note,
      created_at,
      updated_at,
      created_by_user_id,
      review_status,
      reviewed_at,
      reviewed_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
    `
  ).run(
    2026,
    6,
    "Monaco Grand Prix",
    "R6 - Monaco Grand Prix",
    "autofill_backfill",
    "playwright seed",
    now,
    now,
    "pending"
  );
  const snapshotId = Number(snapshotResult.lastInsertRowid);
  db.prepare(
    `
    INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
    VALUES (?, ?, ?)
    `
  ).run(snapshotId, "all_teams_score_points", "yes");
  db.close();

  await page.goto("/admin/actuals");

  await expect(page.locator("[data-admin-actuals-season-form] select[name=season]")).toBeVisible();
  await expect(page.locator("[data-admin-actuals-target-form]")).toHaveCount(0);
  await expect(page.locator("[data-admin-actuals-form]")).toBeVisible();
  await expect(page.locator("[data-admin-actuals-form]")).toContainText("Does every team score points?");
  await expect(page.locator('[data-admin-actuals-round="6"][data-review-status="pending"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/admin/race-data"][href*="round=6"]').first()).toBeVisible();
  await expect(page.locator("[data-admin-actuals-form] form")).toHaveCount(0);

  await page.goto("/admin/race-data?season=2026&round=6&view=drivers&focus=points");
  const reviewForm = page.locator("[data-race-data-review-form]");
  await expect(reviewForm).toBeVisible();
  await reviewForm.getByRole("button", { name: /Mark reviewed/i }).click();
  await expect(page.getByText(/marked as reviewed/i)).toBeVisible();

  await page.goto("/admin/actuals?season=2026");
  await expect(page.locator('[data-admin-actuals-round="6"][data-review-status="reviewed"]').first()).toBeVisible();
  await expect(page.locator("[data-admin-actuals-form] form")).toHaveCount(0);
});

test("admin actuals and admin tables fit phone-width screens", async ({ page }) => {
  await page.goto("/");

  const cases = [
    { width: 390, height: 844, theme: "light" },
    { width: 390, height: 844, theme: "dark" },
    { width: 1280, height: 900, theme: "light" },
    { width: 1280, height: 900, theme: "dark" }
  ];

  for (const testCase of cases) {
    await page.setViewportSize({ width: testCase.width, height: testCase.height });
    await page.goto("/admin/actuals");
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }, testCase.theme);
    await expect(page.getByRole("heading", { name: "Season actuals" })).toBeVisible();
    await expect(page.locator("[data-admin-actuals-form]")).toBeVisible();

    const actualsMetrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const seasonSelect = document.querySelector('[data-admin-actuals-season-form] select[name="season"]');
      const overviewTable = document.querySelector(".admin-actuals-overview-table");
      return {
        theme: document.documentElement.getAttribute("data-theme"),
        overflowX: Math.max(
          document.documentElement.scrollWidth - viewportWidth,
          document.body.scrollWidth - document.body.clientWidth
        ),
        seasonWidth: seasonSelect ? Math.round(seasonSelect.getBoundingClientRect().width) : 0,
        overviewTableRight: overviewTable ? Math.round(overviewTable.getBoundingClientRect().right) : 0,
        overviewRows: document.querySelectorAll(".admin-actuals-question-cell").length
      };
    });

    expect(actualsMetrics.theme).toBe(testCase.theme);
    expect(actualsMetrics.overflowX).toBeLessThanOrEqual(0);
    expect(actualsMetrics.seasonWidth).toBeLessThanOrEqual(testCase.width);
    expect(actualsMetrics.overviewRows).toBeGreaterThan(0);

    await page.goto("/admin/overview");
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }, testCase.theme);
    await expect(page.getByRole("heading", { name: "Admin overview" })).toBeVisible();
    const overviewMetrics = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      overflowX: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth
      ),
      scrollRegions: document.querySelectorAll(".admin-table-scroll").length,
      internalWideTables: Array.from(document.querySelectorAll(".admin-table-scroll")).filter(
        (region) => region.scrollWidth > region.clientWidth
      ).length
    }));

    expect(overviewMetrics.theme).toBe(testCase.theme);
    expect(overviewMetrics.overflowX).toBeLessThanOrEqual(0);
    expect(overviewMetrics.scrollRegions).toBeGreaterThanOrEqual(4);
    if (testCase.width < 720) {
      expect(overviewMetrics.internalWideTables).toBeGreaterThan(0);
    }
  }
});
