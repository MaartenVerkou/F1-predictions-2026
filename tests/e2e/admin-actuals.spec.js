"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");
const { ensureRaceDataSchema, saveRaceDataSnapshot } = require("../../src/race-data-evidence");
const { ensureSeasonInputsSchema } = require("../../src/season-inputs");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

test("admin actuals shows the derived question matrix while Race Data owns review", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  db.dialect = "sqlite";
  const now = new Date().toISOString();
  ensureSeasonInputsSchema(db);
  db.prepare(
    `INSERT OR IGNORE INTO seasons (year, label, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(2026, "2026", "active", now, now);
  ensureRaceDataSchema(db);
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
  const evidenceId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "playwright-evidence-r6",
    fetchedAt: now,
    sourceType: "playwright",
    sourceNote: "playwright seed",
    evidence: {
      season: 2026,
      roundNumber: 6,
      roundName: "Monaco Grand Prix",
      fetchedAt: now,
      cutoffRound: 6,
      coverage: { status: "complete", sources: { race: { count: 1 } } },
      race: {
        rows: [{
          driver_id: 1,
          driver: "Alexander Albon",
          constructor: "Williams",
          position: 1,
          positionText: "1",
          grid: 1,
          status: "Finished",
          points: 25
        }]
      },
      qualifying: { rows: [] },
      sprint: { rows: [] }
    }
  });
  db.prepare("UPDATE actual_snapshots SET source_data_snapshot_id = ? WHERE id = ?").run(evidenceId, snapshotId);
  db.prepare(
    `
    INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
    VALUES (?, ?, ?)
    `
  ).run(snapshotId, "all_teams_score_points", "yes");
  db.close();

  await page.goto("/admin/results");

  await expect(page.locator("[data-admin-results-season-form] select[name=season]")).toBeVisible();
  await expect(page.locator("[data-admin-actuals-target-form]")).toHaveCount(0);
  await expect(page.locator("[data-admin-actuals-form]")).toBeVisible();
  const firstQuestionLink = page.locator("[data-admin-actuals-form] .admin-actuals-question-short-link").first();
  await expect(firstQuestionLink).toHaveText(/^Q\d+$/);
  await expect(firstQuestionLink).toHaveAttribute("title", /·/);
  await expect(page.locator('[data-admin-actuals-round="6"][data-review-status="pending"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/admin/race-data"][href*="round=6"]').first()).toBeVisible();
  await expect(page.locator("[data-admin-actuals-form] form")).toHaveCount(0);

  await page.goto("/admin/race-data?season=2026&round=6&view=drivers&focus=points");
  const reviewForm = page.locator("[data-race-data-review-form]");
  await expect(reviewForm).toBeVisible();
  await reviewForm.getByRole("button", { name: /Mark reviewed/i }).click();
  await expect(page.getByText(/marked as reviewed/i)).toHaveCount(0);
  await expect(page.locator("[data-race-data-review-status]")).toContainText(/Reviewed by/);
  await expect(page.locator("[data-race-data-review-status]")).toContainText(/2026/);
  await expect(page.locator("[data-race-data-review-status]")).not.toContainText(/\d{1,2}:\d{2}/);

  const editButton = page.locator("[data-race-data-edit]");
  await expect(editButton).toBeVisible();
  await editButton.click();
  await expect(page.locator("[data-race-data-edit-input]").first()).toBeEnabled();
  await page.getByRole("button", { name: /Discard/i }).click();
  await expect(page.locator("[data-race-data-edit-input]").first()).toBeDisabled();

  await editButton.click();
  await page.locator("[data-race-data-editor-details] textarea[name=correctionReason]").fill("Correct a verified result row in the review workspace.");
  await page.locator("[data-race-data-editor-details] input[name=confirmCorrection]").check();
  await page.getByRole("button", { name: /Save changes/i }).click();
  await expect(page.locator("[data-race-data-review-status]")).toContainText(/Edited by/);

  await page.goto("/admin/results?season=2026");
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
    await page.goto("/admin/results");
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }, testCase.theme);
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.locator("[data-admin-actuals-form]")).toBeVisible();

    const actualsMetrics = await page.evaluate(() => {
      const viewportWidth = document.documentElement.clientWidth;
      const seasonSelect = document.querySelector('[data-admin-results-season-form] select[name="season"]');
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

test("admin actuals keeps one stable table layout across normal and compact modes", async ({ page }) => {
  for (const width of [390, 600, 720, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/results?season=2026");
    await expect(page.locator(".admin-actuals-overview-table")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const table = document.querySelector(".admin-actuals-overview-table");
      const wrapper = document.querySelector(".admin-actuals-overview-wrap");
      const question = table?.querySelector(".admin-actuals-question-cell");
      const round = table?.querySelector(".admin-actuals-round-column");
      const value = table?.querySelector(".admin-actuals-value-cell");
      const values = [...document.querySelectorAll(".admin-actuals-value-cell a")];
      const questionLink = question?.querySelector(".admin-actuals-question-short-link");
      const reviewMarkers = [...document.querySelectorAll(".admin-actuals-review-marker")];
      const reviewMarkerSameLine = reviewMarkers.every((marker) => {
        const markerRect = marker.getBoundingClientRect();
        const name = marker.closest(".admin-actuals-round-header")?.querySelector(".admin-actuals-round-name");
        if (!name) return false;
        return Math.abs(markerRect.top - name.getBoundingClientRect().top) <= 2;
      });
      const rows = [...document.querySelectorAll(".admin-actuals-overview-table tbody tr")];
      const overflows = (elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).length;
      return {
        pageOverflow: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - document.body.clientWidth),
        tableOverflow: wrapper ? wrapper.scrollWidth > wrapper.clientWidth : false,
        questionWidth: question ? Math.round(question.getBoundingClientRect().width) : 0,
        roundWidth: round ? Math.round(round.getBoundingClientRect().width) : 0,
        valueWidth: value ? Math.round(value.getBoundingClientRect().width) : 0,
        valueOverflows: overflows(values),
        markerOverflows: overflows(reviewMarkers),
        reviewMarkerCount: reviewMarkers.length,
        reviewMarkerSameLine,
        pendingCellsWithBorderClass: document.querySelectorAll(".admin-actuals-round-column.is-pending, .admin-actuals-value-cell.is-pending").length,
        rowAlignment: rows.every((row) => [...row.children].every((cell) => Math.round(cell.getBoundingClientRect().height) === Math.round(row.getBoundingClientRect().height))),
        questionKey: questionLink?.textContent.trim() || "",
        questionTitle: questionLink?.getAttribute("title") || "",
        legacyLineMarkup: Boolean(document.querySelector(".admin-actuals-value-line"))
      };
    });

    expect(metrics.pageOverflow).toBeLessThanOrEqual(0);
    expect(metrics.tableOverflow).toBe(true);
    expect(metrics.valueWidth).toBe(metrics.roundWidth);
    expect(metrics.valueOverflows).toBe(0);
    expect(metrics.markerOverflows).toBe(0);
    expect(metrics.reviewMarkerSameLine).toBe(true);
    expect(metrics.pendingCellsWithBorderClass).toBe(0);
    expect(metrics.rowAlignment).toBe(true);
    expect(metrics.legacyLineMarkup).toBe(false);
    expect(metrics.questionWidth).toBe(58);
    expect(metrics.questionKey).toMatch(/^Q\d+$/);
    expect(metrics.questionTitle).toContain("·");
  }
});
