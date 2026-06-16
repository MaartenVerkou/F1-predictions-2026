"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const { expect, test } = require("@playwright/test");

const DB_PATH = path.join(__dirname, "..", "..", ".tmp", "playwright-state", "app.db");

const QUESTIONS = [
  "all_teams_score_points",
  "mini_q1_first_race_winner_champion",
  "mini_q2_mercedes_engines_top5",
  "races_before_title_decided"
];

function upsertUser(db, { name, email, isAdmin = 0 }) {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO users (
      name,
      email,
      password_hash,
      created_at,
      is_verified,
      verified_at,
      is_admin,
      is_simulated,
      hide_from_global
    )
    VALUES (?, ?, 'playwright-password-hash', ?, 1, ?, ?, 0, 0)
    ON CONFLICT(email) DO UPDATE SET
      name = excluded.name,
      is_verified = 1,
      verified_at = COALESCE(users.verified_at, excluded.verified_at),
      is_admin = excluded.is_admin,
      is_simulated = 0,
      hide_from_global = 0
    `
  ).run(name, email, now, now, isAdmin);
  return db.prepare("SELECT id, name FROM users WHERE email = ?").get(email);
}

function seedLeaderboardInsights(db) {
  const now = new Date().toISOString();
  const devAdmin = upsertUser(db, {
    name: "Dev Admin",
    email: "dev@example.com",
    isAdmin: 1
  });
  const globalGroup = db.prepare("SELECT id FROM groups WHERE is_global = 1 LIMIT 1").get();
  if (!globalGroup) throw new Error("Expected Playwright dev server to create the global group.");
  const groupId = Number(globalGroup.id);

  db.prepare("DELETE FROM actual_snapshot_values").run();
  db.prepare("DELETE FROM actual_snapshots").run();
  db.prepare("DELETE FROM actuals").run();
  db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM guest_responses WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM named_guest_group_members WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);

  const participants = [
    { name: "E2E Insight Apex", email: "e2e-insight-apex@example.local", answers: ["yes", "no", "yes", "0"] },
    { name: "E2E Insight Clutch", email: "e2e-insight-clutch@example.local", answers: ["yes", "no", "no", "0"] },
    { name: "E2E Insight Drift", email: "e2e-insight-drift@example.local", answers: ["yes", "yes", "yes", "0"] },
    { name: "E2E Insight Esses", email: "e2e-insight-esses@example.local", answers: ["yes", "no", "yes", "2"] },
    { name: "E2E Insight Flow", email: "e2e-insight-flow@example.local", answers: ["no", "no", "yes", "0"] },
    { name: "E2E Insight Grid", email: "e2e-insight-grid@example.local", answers: ["yes", "no", "no", "2"] },
    { name: "E2E Insight Halo", email: "e2e-insight-halo@example.local", answers: ["yes", "yes", "no", "0"] },
    { name: "E2E Insight Kerb", email: "e2e-insight-kerb@example.local", answers: ["no", "no", "yes", "2"] },
    { name: "E2E Insight Lift", email: "e2e-insight-lift@example.local", answers: ["yes", "yes", "no", "2"] },
    { name: "E2E Insight Pace", email: "e2e-insight-pace@example.local", answers: ["no", "yes", "yes", "2"] },
    { name: "E2E Insight Vector", email: "e2e-insight-vector@example.local", answers: ["no", "yes", "no", "2"] }
  ];
  const users = participants.map((participant) => upsertUser(db, participant));
  const allUsers = [...users, devAdmin];

  const insertMember = db.prepare(
    "INSERT OR REPLACE INTO group_members (user_id, group_id, role, joined_at, coupled_to_global) VALUES (?, ?, ?, ?, 1)"
  );
  allUsers.forEach((user) => {
    insertMember.run(Number(user.id), groupId, Number(user.id) === Number(devAdmin.id) ? "owner" : "member", now);
  });

  const insertResponse = db.prepare(
    `
    INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, group_id, question_id) DO UPDATE SET
      answer = excluded.answer,
      updated_at = excluded.updated_at
    `
  );
  users.forEach((user, index) => {
    const participant = participants[index];
    QUESTIONS.forEach((questionId, questionIndex) => {
      insertResponse.run(user.id, groupId, questionId, participant.answers[questionIndex], now, now);
    });
  });
  ["no", "yes", "no", "2"].forEach((answer, questionIndex) => {
    insertResponse.run(devAdmin.id, groupId, QUESTIONS[questionIndex], answer, now, now);
  });

  const insertSnapshot = db.prepare(
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
      review_status,
      reviewed_at
    )
    VALUES (2026, ?, ?, ?, 'playwright', 'leaderboard insights seed', ?, ?, 'reviewed', ?)
    `
  );
  const insertSnapshotValue = db.prepare(
    "INSERT INTO actual_snapshot_values (snapshot_id, question_id, value) VALUES (?, ?, ?)"
  );
  const round1 = insertSnapshot.run(1, "Australian Grand Prix", "R1 - Australian Grand Prix", now, now, now);
  insertSnapshotValue.run(round1.lastInsertRowid, QUESTIONS[0], "yes");

  const round2 = insertSnapshot.run(2, "Chinese Grand Prix", "R2 - Chinese Grand Prix", now, now, now);
  const currentActuals = {
    [QUESTIONS[0]]: "yes",
    [QUESTIONS[1]]: "no",
    [QUESTIONS[2]]: "yes",
    [QUESTIONS[3]]: "0"
  };
  Object.entries(currentActuals).forEach(([questionId, value]) => {
    insertSnapshotValue.run(round2.lastInsertRowid, questionId, value);
    db.prepare(
      "INSERT INTO actuals (question_id, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(questionId, value, now);
  });

  const privateGroupId = 990001;
  db.prepare("DELETE FROM responses WHERE group_id = ?").run(privateGroupId);
  db.prepare("DELETE FROM guest_responses WHERE group_id = ?").run(privateGroupId);
  db.prepare("DELETE FROM named_guest_group_members WHERE group_id = ?").run(privateGroupId);
  db.prepare("DELETE FROM group_members WHERE group_id = ?").run(privateGroupId);
  db.prepare("DELETE FROM groups WHERE id = ?").run(privateGroupId);
  db.prepare(
    `
    INSERT INTO groups (
      id,
      name,
      owner_id,
      created_at,
      is_global,
      is_public,
      join_password_hash,
      is_simulated,
      invite_link_open
    )
    VALUES (?, 'E2E Private League', ?, ?, 0, 0, NULL, 0, 0)
    `
  ).run(privateGroupId, devAdmin.id, now);
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at, coupled_to_global) VALUES (?, ?, 'owner', ?, 1)"
  ).run(devAdmin.id, privateGroupId, now);

  return { devAdminId: Number(devAdmin.id), privateGroupId };
}

test("leaderboard shows trend chart, latest-race movement, selected insights, and breakdown modes", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { devAdminId } = seedLeaderboardInsights(db);
  db.close();

  await page.goto("/global/leaderboard");

  await expect(page.getByText(/Live scoring reflects/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Points over rounds/i })).toHaveCount(0);
  await expect(page.getByText(/Top 10 plus selected participants/i)).toHaveCount(0);
  await expect(page.getByText(/Last race: R1 to R2/i)).toHaveCount(0);
  await expect(page.locator(".leaderboard-trend-chart")).toBeVisible();
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("CHANGE");
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("POSITION");
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("POINTS");
  await expect(page.locator(".leaderboard-delta-header")).toHaveAttribute(
    "aria-label",
    "Rank change since latest race"
  );
  const leaderboardHeaders = await page.locator(".leaderboard-main-card thead th").evaluateAll((headers) =>
    headers.map((header) => header.textContent.trim())
  );
  expect(leaderboardHeaders).toEqual(["POS", "NAME", "PTS", ""]);
  const flowRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Flow" });
  await expect(flowRow.locator(".leaderboard-delta-cell")).toHaveText("+5");
  const apexRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Apex" });
  await expect(apexRow.locator(".leaderboard-delta-cell")).toHaveText("-");
  await expect(page.locator(".leaderboard-chart-legend")).toContainText("Dev Admin");
  await expect(page.locator(".leaderboard-chart-legend")).not.toContainText("25 pts");

  const selectedPanel = page.locator(".leaderboard-selected-panel");
  const apexLegendItem = page.locator(".leaderboard-chart-legend-item", { hasText: "E2E Insight Apex" });
  await expect(apexLegendItem).not.toContainText("#1");
  const clutchLegendItem = page.locator(".leaderboard-chart-legend-item", { hasText: "E2E Insight Clutch" });
  const clutchSeriesId = await clutchLegendItem.locator(".leaderboard-chart-toggle").getAttribute("data-chart-series-toggle");
  await clutchLegendItem.hover();
  await expect.poll(async () =>
    page.locator(`[data-chart-series="${clutchSeriesId}"]`).evaluate((node) => node.classList.contains("is-hovered"))
  ).toBe(true);
  await page.mouse.move(10, 10);
  await expect.poll(async () =>
    page.locator(`[data-chart-series="${clutchSeriesId}"]`).evaluate((node) => node.classList.contains("is-hovered"))
  ).toBe(false);

  await page.evaluate(() => {
    window.__leaderboardSelectionMarker = "same-document";
  });
  await apexLegendItem.getByRole("link", { name: "E2E Insight Apex" }).click();
  await expect(selectedPanel.getByRole("heading", { name: "E2E Insight Apex" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__leaderboardSelectionMarker)).toBe("same-document");

  const selectedUrl = page.url();
  const apexToggle = page.getByRole("checkbox", { name: "E2E Insight Apex" });
  await expect(apexToggle).toBeChecked();
  const apexSeriesId = await apexToggle.getAttribute("data-chart-series-toggle");
  expect(apexSeriesId).toBeTruthy();
  await apexToggle.uncheck();
  expect(page.url()).toBe(selectedUrl);
  await expect(page.locator(`[data-chart-series="${apexSeriesId}"]`)).toHaveAttribute("hidden", "");
  await apexToggle.check();
  expect(page.url()).toBe(selectedUrl);
  await expect(page.locator(`[data-chart-series="${apexSeriesId}"]`)).not.toHaveAttribute("hidden", "");

  await page.goto(`/global/leaderboard?participant=${devAdminId}`);
  await expect(selectedPanel.getByRole("heading", { name: "Dev Admin" })).toBeVisible();
  await expect(selectedPanel).toContainText("No scored questions for this participant yet.");

  await selectedPanel.getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(new RegExp(`participant=${devAdminId}.*breakdown=all|breakdown=all.*participant=${devAdminId}`));
  const allRowsCount = await page.locator("#leaderboard-breakdown tbody tr").count();
  const unscoredRowsCount = await page.locator("#leaderboard-breakdown tbody tr.is-unscored").count();
  expect(allRowsCount).toBeGreaterThanOrEqual(QUESTIONS.length);
  expect(unscoredRowsCount).toBeGreaterThanOrEqual(QUESTIONS.length);

  await page.locator(".leaderboard-main-card .leaderboard-row-link", { hasText: "E2E Insight Clutch" }).click();
  await expect(selectedPanel.getByRole("heading", { name: "E2E Insight Clutch" })).toBeVisible();
  await expect(selectedPanel.locator(".leaderboard-selected-metrics")).toHaveCount(0);
  await expect(selectedPanel.locator(".leaderboard-member-meta")).toContainText("+15 pts");
  await expect(selectedPanel.locator(".leaderboard-member-meta")).toContainText("steady");
  await expect(selectedPanel.locator(".leaderboard-insight-question-chip").first()).toHaveText(/Q\d+/);
  const summaryText = await selectedPanel.locator(".leaderboard-insight-summary").evaluateAll((summaries) =>
    summaries.map((summary) => summary.innerText).join(" ")
  );
  expect(summaryText).toContain("E2E Insight Clutch");
  expect(summaryText).toContain("pts");
  expect(summaryText).toMatch(/questions?/);
  expect(summaryText).not.toMatch(/Best edge|Biggest gap|Most distinctive/);
  await expect(selectedPanel.locator(".leaderboard-insight-context")).toHaveCount(0);
  const visibleInsightText = await selectedPanel.locator(".leaderboard-insight-list").evaluateAll((lists) =>
    lists.map((list) => list.innerText).join(" ")
  );
  expect(visibleInsightText).not.toContain("Does every team score points?");
  expect(visibleInsightText).not.toContain("gap");
  expect(visibleInsightText).not.toContain("edge");
  expect(visibleInsightText).not.toContain("pick");
  await selectedPanel.locator(".leaderboard-insight-question-chip").first().focus();
  await expect(selectedPanel.locator(".leaderboard-question-tooltip").first()).toBeVisible();

  await selectedPanel.getByRole("link", { name: "Scored" }).click();
  await expect(page.locator("#leaderboard-breakdown tbody tr")).toHaveCount(3);
  await expect(page.locator("#leaderboard-breakdown tbody tr.is-unscored")).toHaveCount(0);
});

test("global leaderboard is public while private group leaderboard stays protected", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { privateGroupId } = seedLeaderboardInsights(db);
  db.close();

  await page.getByRole("button", { name: "Visitor" }).click();

  await page.goto("/global/leaderboard");
  await expect(page.getByRole("heading", { name: /Global: Leaderboard/i })).toBeVisible();
  await expect(page.locator(".leaderboard-main-card")).toBeVisible();
  await expect(page.locator(".leaderboard-breakdown-locked")).toContainText(
    "Sign in to view detailed predictions"
  );
  await expect(page.locator("#leaderboard-breakdown")).toHaveCount(0);

  await page.goto(`/groups/${privateGroupId}/leaderboard`);
  await expect(page).toHaveURL(/\/login/);
});

test("anonymous home preview opens the public global leaderboard without login", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  seedLeaderboardInsights(db);
  db.close();

  await page.getByRole("button", { name: "Visitor" }).click();
  await page.goto("/");

  const previewLinks = page.locator(".home-leaderboard-preview a[href='/global/leaderboard']");
  await expect(previewLinks).toHaveCount(2);
  await previewLinks.first().click();

  await expect(page).toHaveURL(/\/global\/leaderboard/);
  await expect(page.getByRole("heading", { name: /Global: Leaderboard/i })).toBeVisible();
  await expect(page.locator("form[action='/login']")).toHaveCount(0);
});

test("leaderboard presentation fits desktop and phone in light and dark mode", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  seedLeaderboardInsights(db);
  db.close();

  await page.getByRole("button", { name: "Visitor" }).click();

  const cases = [
    { width: 1440, height: 950, theme: "light" },
    { width: 390, height: 844, theme: "light" },
    { width: 1440, height: 950, theme: "dark" },
    { width: 390, height: 844, theme: "dark" }
  ];

  for (const testCase of cases) {
    await page.setViewportSize({ width: testCase.width, height: testCase.height });
    await page.goto("/global/leaderboard");
    await page.evaluate((theme) => {
      localStorage.setItem("theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
    }, testCase.theme);

    await expect(page.locator(".leaderboard-trend-panel")).toBeVisible();
    await expect(page.locator(".leaderboard-chart-content")).toBeVisible();
    await expect(page.locator(".leaderboard-main-card")).toBeVisible();
    await expect(page.locator(".leaderboard-detail-card")).toBeVisible();
    await expect(page.locator(".leaderboard-breakdown-locked")).toContainText("Sign in");

    const metrics = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute("data-theme"),
      overflowX: Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth
      ),
      legendItems: document.querySelectorAll(".leaderboard-chart-legend-item").length,
      rows: document.querySelectorAll(".leaderboard-main-card tbody tr").length,
      nestedDetailPanels: document.querySelectorAll(".leaderboard-member-panel").length,
      mainTop: Math.round(document.querySelector(".leaderboard-main-column").getBoundingClientRect().top),
      mainRight: Math.round(document.querySelector(".leaderboard-main-column").getBoundingClientRect().right),
      mainWidth: Math.round(document.querySelector(".leaderboard-main-column").getBoundingClientRect().width),
      detailLeft: Math.round(document.querySelector(".leaderboard-detail-card").getBoundingClientRect().left),
      detailWidth: Math.round(document.querySelector(".leaderboard-detail-card").getBoundingClientRect().width),
      chartTop: Math.round(document.querySelector(".leaderboard-trend-panel").getBoundingClientRect().top),
      chartBottom: Math.round(document.querySelector(".leaderboard-trend-panel").getBoundingClientRect().bottom),
      chartHeight: Math.round(document.querySelector(".leaderboard-trend-panel").getBoundingClientRect().height),
      chartWidth: Math.round(document.querySelector(".leaderboard-trend-panel").getBoundingClientRect().width),
      chartWrapRight: Math.round(document.querySelector(".leaderboard-chart-wrap").getBoundingClientRect().right),
      chartWrapBottom: Math.round(document.querySelector(".leaderboard-chart-wrap").getBoundingClientRect().bottom),
      chartSvgHeight: Math.round(document.querySelector(".leaderboard-trend-chart").getBoundingClientRect().height),
      legendLeft: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().left),
      legendTop: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().top),
      legendWidth: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().width),
      mainHeight: Math.round(document.querySelector(".leaderboard-main-column").getBoundingClientRect().height),
      checkedControls: document.querySelectorAll(".leaderboard-chart-legend input[type='checkbox']:checked").length,
      detailTop: Math.round(document.querySelector(".leaderboard-detail-card").getBoundingClientRect().top)
    }));

    expect(metrics.theme).toBe(testCase.theme);
    expect(metrics.overflowX).toBeLessThanOrEqual(0);
    expect(metrics.legendItems).toBeGreaterThan(0);
    expect(metrics.rows).toBeGreaterThan(0);
    expect(metrics.nestedDetailPanels).toBe(0);
    expect(metrics.chartTop).toBeLessThan(metrics.mainTop);
    expect(metrics.detailTop).toBeGreaterThanOrEqual(metrics.chartBottom);

    if (testCase.width >= 1100) {
      expect(metrics.legendLeft).toBeGreaterThanOrEqual(metrics.chartWrapRight);
      expect(metrics.chartWidth).toBeGreaterThan(metrics.mainWidth);
      expect(metrics.legendWidth).toBeGreaterThanOrEqual(260);
      expect(metrics.chartSvgHeight).toBeGreaterThanOrEqual(250);
      expect(metrics.chartBottom).toBeLessThanOrEqual(metrics.mainTop);
      expect(metrics.detailLeft).toBeGreaterThanOrEqual(metrics.mainRight);
      expect(metrics.detailWidth / metrics.mainWidth).toBeGreaterThanOrEqual(0.9);
      expect(metrics.detailWidth / metrics.mainWidth).toBeLessThanOrEqual(1.1);
      expect(Math.abs(metrics.detailTop - metrics.mainTop)).toBeLessThanOrEqual(8);
    } else {
      expect(metrics.legendTop).toBeGreaterThanOrEqual(metrics.chartWrapBottom);
      expect(metrics.mainTop).toBeGreaterThanOrEqual(metrics.chartBottom);
      expect(metrics.detailTop).toBeGreaterThanOrEqual(metrics.mainTop);
    }
    expect(metrics.checkedControls).toBeGreaterThan(0);
  }
});
