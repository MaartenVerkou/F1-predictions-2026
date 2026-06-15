"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

test("admin actuals shows pending review backlog and can mark latest sync reviewed", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  db.exec(`
    DELETE FROM actual_snapshot_values;
    DELETE FROM actual_snapshots;
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
  db.prepare(
    `
    INSERT INTO actuals (question_id, value, updated_at)
    VALUES (?, ?, ?)
    `
  ).run("all_teams_score_points", "yes", now);
  db.close();

  await page.goto("/admin/actuals");

  await expect(page.locator("body")).toContainText("Review backlog:");
  await expect(page.locator("body")).toContainText("1 round snapshot still need admin review.");
  await expect(
    page.getByRole("button", { name: /Mark latest synced round reviewed/i })
  ).toBeVisible();

  await page.getByRole("button", { name: /Mark latest synced round reviewed/i }).click();

  await expect(page.getByText(/marked as reviewed/i)).toBeVisible();
  await expect(page.getByText(/Status:\s*Reviewed/i)).toBeVisible();
});
