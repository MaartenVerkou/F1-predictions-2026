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

const getHorizontalOverflow = async (page) =>
  page.evaluate(() =>
    Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth
    )
  );

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

function seedLeaderboardInsights(db, { includeThirdSnapshot = false } = {}) {
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
  const upsertCurrentActual = db.prepare(
    "INSERT INTO actuals (question_id, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  );
  const saveSnapshotValues = (snapshotId, values, { updateCurrent = false } = {}) => {
    Object.entries(values).forEach(([questionId, value]) => {
      insertSnapshotValue.run(snapshotId, questionId, value);
      if (updateCurrent) {
        upsertCurrentActual.run(questionId, value, now);
      }
    });
  };
  const round1 = insertSnapshot.run(1, "Australian Grand Prix", "R1 - Australian Grand Prix", now, now, now);
  insertSnapshotValue.run(round1.lastInsertRowid, QUESTIONS[0], "yes");

  const round2 = insertSnapshot.run(2, "Chinese Grand Prix", "R2 - Chinese Grand Prix", now, now, now);
  const round2Actuals = {
    [QUESTIONS[0]]: "yes",
    [QUESTIONS[1]]: "no",
    [QUESTIONS[2]]: "yes",
    [QUESTIONS[3]]: "0"
  };
  saveSnapshotValues(round2.lastInsertRowid, round2Actuals, { updateCurrent: !includeThirdSnapshot });

  const snapshotIds = {
    round1: Number(round1.lastInsertRowid),
    round2: Number(round2.lastInsertRowid),
    round3: null
  };

  if (includeThirdSnapshot) {
    const round3 = insertSnapshot.run(3, "Japanese Grand Prix", "R3 - Japanese Grand Prix", now, now, now);
    const round3Actuals = {
      ...round2Actuals,
      [QUESTIONS[3]]: "2"
    };
    snapshotIds.round3 = Number(round3.lastInsertRowid);
    saveSnapshotValues(round3.lastInsertRowid, round3Actuals, { updateCurrent: true });
  }

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

  return { devAdminId: Number(devAdmin.id), privateGroupId, snapshotIds };
}

function seedGlobalDashboardAnswers(db) {
  const now = new Date().toISOString();
  const devAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@example.com");
  const globalGroup = db.prepare("SELECT id FROM groups WHERE is_global = 1 LIMIT 1").get();
  if (!devAdmin || !globalGroup) {
    throw new Error("Expected dashboard seed users and global group to exist.");
  }

  const insertResponse = db.prepare(
    `
    INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, group_id, question_id) DO UPDATE SET
      answer = excluded.answer,
      updated_at = excluded.updated_at
    `
  );
  insertResponse.run(
    devAdmin.id,
    globalGroup.id,
    "drivers_championship_top_3",
    JSON.stringify(["Lewis Hamilton", "Max Verstappen", "Kimi Antonelli"]),
    now,
    now
  );
  insertResponse.run(
    devAdmin.id,
    globalGroup.id,
    "constructors_championship_top_3",
    JSON.stringify(["Ferrari", "McLaren", "Mercedes"]),
    now,
    now
  );
}

test("leaderboard shows trend chart, latest-race movement, selected insights, and breakdown modes", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { devAdminId, snapshotIds } = seedLeaderboardInsights(db);
  db.close();

  await page.goto("/global/leaderboard");

  await expect(page.getByText(/Live scoring reflects/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Points over rounds/i })).toHaveCount(0);
  await expect(page.getByText(/Top 10 plus selected participants/i)).toHaveCount(0);
  await expect(page.getByText(/Last race: R1 to R2/i)).toHaveCount(0);
  await expect(page.locator(".leaderboard-trend-chart")).toBeVisible();
  await expect(page.locator("#snapshot-select")).toHaveValue(String(snapshotIds.round2));
  await expect(page.locator("#snapshot-select option", { hasText: "Current" })).toHaveCount(0);
  const chartDomain = await page.locator(".leaderboard-trend-chart").evaluate((chart) => {
    const marker = chart.querySelector("[data-chart-selected-round-marker]");
    const circles = Array.from(chart.querySelectorAll("circle.leaderboard-chart-line"))
      .map((circle) => Number(circle.getAttribute("cy")))
      .filter(Number.isFinite);
    return {
      min: Number(chart.getAttribute("data-chart-domain-min")),
      max: Number(chart.getAttribute("data-chart-domain-max")),
      selectedRoundId: chart.getAttribute("data-chart-selected-round-id"),
      markerX: marker ? Number(marker.getAttribute("x1")) : null,
      minPointY: Math.min(...circles),
      maxPointY: Math.max(...circles),
      axisLabels: Array.from(chart.querySelectorAll(".leaderboard-chart-label")).map((label) =>
        label.textContent.trim()
      )
    };
  });
  expect(chartDomain.min).toBeGreaterThan(0);
  expect(chartDomain.max).toBeGreaterThan(chartDomain.min);
  expect(chartDomain.selectedRoundId).toBe(String(snapshotIds.round2));
  expect(chartDomain.markerX).not.toBeNull();
  expect(chartDomain.minPointY).toBeGreaterThanOrEqual(16);
  expect(chartDomain.maxPointY).toBeLessThanOrEqual(318);
  expect(chartDomain.axisLabels).toContain(String(chartDomain.min));
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("CHANGE");
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("POSITION");
  await expect(page.locator(".leaderboard-main-card thead")).not.toContainText("POINTS");
  await expect(page.locator(".leaderboard-delta-header")).toHaveCount(0);
  const leaderboardHeaders = await page.locator(".leaderboard-main-card thead th").evaluateAll((headers) =>
    headers.map((header) => header.textContent.trim())
  );
  expect(leaderboardHeaders).toEqual(["POS", "NAME", "PTS"]);
  const leaderboardHeaderStyles = await page.locator(".leaderboard-main-card thead th").evaluateAll((headers) =>
    headers.map((header) => ({
      color: getComputedStyle(header).color,
      fontSize: getComputedStyle(header).fontSize,
      fontWeight: getComputedStyle(header).fontWeight
    }))
  );
  expect(leaderboardHeaderStyles[1]).toEqual(leaderboardHeaderStyles[0]);
  await expect(page.locator(".leaderboard-main-card")).not.toContainText(/Showing|Toont/);
  const paginationText = await page.locator(".leaderboard-main-card .admin-pagination").innerText();
  expect(paginationText).not.toContain("<<");
  expect(paginationText).not.toContain(">>");
  const flowRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Flow" });
  await expect(flowRow.locator("td")).toHaveCount(3);
  await expect(flowRow.locator(".leaderboard-position-delta")).toHaveText("5");
  await expect(flowRow.locator(".leaderboard-position-delta")).toHaveAttribute("data-rank-delta-direction", "up");
  await expect(flowRow.locator(".leaderboard-position-delta")).toHaveAttribute(
    "aria-label",
    "Rank change since previous saved race: +5"
  );
  const apexRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Apex" });
  await expect(apexRow.locator(".leaderboard-position-delta")).toHaveText("-");
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
  await page.mouse.move(10, 10);
  const selectedStrokeBeforeHover = await page.locator(`[data-chart-series="${apexSeriesId}"] polyline`).evaluate((node) =>
    parseFloat(getComputedStyle(node).strokeWidth)
  );
  await page.locator(".leaderboard-chart-legend-item", { hasText: "E2E Insight Apex" }).hover();
  await expect.poll(async () =>
    page.locator(`[data-chart-series="${apexSeriesId}"]`).evaluate((node) => node.classList.contains("is-hovered"))
  ).toBe(true);
  const selectedStrokeOnHover = await page.locator(`[data-chart-series="${apexSeriesId}"] polyline`).evaluate((node) =>
    parseFloat(getComputedStyle(node).strokeWidth)
  );
  expect(selectedStrokeOnHover).toBeGreaterThan(selectedStrokeBeforeHover);
  await page.mouse.move(10, 10);
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

  const flowSeriesId = await page
    .locator(".leaderboard-rank-row", { hasText: "E2E Insight Flow" })
    .getAttribute("data-leaderboard-row-participant");
  await page.locator(".leaderboard-rank-row", { hasText: "E2E Insight Flow" }).hover();
  await expect.poll(async () =>
    page.locator(`[data-chart-series="${flowSeriesId}"]`).evaluate((node) => node.classList.contains("is-hovered"))
  ).toBe(true);
  await expect(page.locator(".leaderboard-chart-legend-item", { hasText: "E2E Insight Flow" })).toHaveClass(/is-hovered/);
  await page.evaluate(() => {
    window.__leaderboardSelectionMarker = "same-document";
  });
  await page.locator(".leaderboard-rank-row", { hasText: "E2E Insight Flow" }).locator("td").first().click();
  await expect(selectedPanel.getByRole("heading", { name: "E2E Insight Flow" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__leaderboardSelectionMarker)).toBe("same-document");

  await selectedPanel.getByRole("link", { name: "Scored" }).click();
  await expect(page.locator("#leaderboard-breakdown tbody tr")).toHaveCount(3);
  await expect(page.locator("#leaderboard-breakdown tbody tr.is-unscored")).toHaveCount(0);
});

test("leaderboard defaults to latest saved race and keeps historical race movement", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { snapshotIds } = seedLeaderboardInsights(db, { includeThirdSnapshot: true });
  db.close();

  await page.goto("/global/leaderboard");
  await expect(page.locator("#snapshot-select")).toHaveValue(String(snapshotIds.round3));
  await expect(page.locator("#snapshot-select option", { hasText: "Current" })).toHaveCount(0);
  await expect(page.locator(".leaderboard-trend-chart")).toHaveAttribute(
    "data-chart-selected-round-id",
    String(snapshotIds.round3)
  );
  await expect(page.locator("[data-chart-selected-round-marker]")).toHaveCount(1);

  await page.goto(`/global/leaderboard?snapshot=${snapshotIds.round2}`);
  await expect(page.locator("#snapshot-select")).toHaveValue(String(snapshotIds.round2));
  const flowRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Flow" });
  await expect(flowRow.locator(".leaderboard-position-delta")).toHaveText("5");
  await expect(flowRow.locator(".leaderboard-position-delta")).toHaveAttribute("data-rank-delta-direction", "up");

  const selectedRoundMarker = await page.locator(".leaderboard-trend-chart").evaluate((chart) => {
    const marker = chart.querySelector("[data-chart-selected-round-marker]");
    const roundLabel = Array.from(chart.querySelectorAll(".leaderboard-chart-label")).find(
      (label) => label.textContent.trim() === "R2"
    );
    return {
      selectedRoundId: chart.getAttribute("data-chart-selected-round-id"),
      markerX: marker ? Number(marker.getAttribute("x1")) : null,
      labelX: roundLabel ? Number(roundLabel.getAttribute("x")) : null
    };
  });
  expect(selectedRoundMarker.selectedRoundId).toBe(String(snapshotIds.round2));
  expect(selectedRoundMarker.markerX).not.toBeNull();
  expect(selectedRoundMarker.markerX).toBeCloseTo(selectedRoundMarker.labelX, 1);
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

test("admin can hide regular users from global results", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  seedLeaderboardInsights(db);
  const hiddenUser = db
    .prepare("SELECT id, name FROM users WHERE email = ?")
    .get("e2e-insight-apex@example.local");
  db.close();

  expect(hiddenUser).toBeTruthy();

  await page.goto("/global/leaderboard");
  await expect(page.locator(".leaderboard-main-card")).toContainText(hiddenUser.name);

  await page.request.post(`/admin/users/${hiddenUser.id}/hide-from-global`, {
    form: {
      hideFromGlobal: "1",
      returnTo: "/admin/overview#admin-users"
    }
  });

  await page.goto("/global/leaderboard");
  await expect(page.locator(".leaderboard-main-card")).not.toContainText(hiddenUser.name);
  await expect(page.locator(".leaderboard-chart-legend")).not.toContainText(hiddenUser.name);

  await page.getByRole("button", { name: "Visitor" }).click();
  await page.goto("/global/responses");
  await expect(page.locator("body")).not.toContainText(hiddenUser.name);
});

test("Dutch leaderboard renders localized insight copy", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { snapshotIds } = seedLeaderboardInsights(db);
  db.prepare("UPDATE actual_snapshots SET label = ? WHERE id = ?").run(
    "R2 - Chinese Grand Prix with an intentionally long official display label for layout testing",
    snapshotIds.round2
  );
  db.close();

  await page.request.post("/language", {
    form: {
      locale: "nl",
      redirectTo: "/"
    }
  });

  await page.goto("/global/leaderboard");
  await expect(page.getByRole("heading", { name: /Global: Klassement/i })).toBeVisible();
  await expect(page.locator(".leaderboard-trend-chart")).toHaveAttribute(
    "aria-label",
    "Klassementspunten over gereden rondes"
  );
  await page.locator(".leaderboard-main-card .leaderboard-row-link", { hasText: "E2E Insight Clutch" }).click();

  const selectedPanel = page.locator(".leaderboard-selected-panel");
  await expect(selectedPanel.getByRole("heading", { name: "E2E Insight Clutch" })).toBeVisible();
  await expect(selectedPanel).toContainText("Sterke punten");
  await expect(selectedPanel).toContainText("Gaten naar boven");
  await expect(selectedPanel).toContainText("Opvallende keuzes");
  await expect(selectedPanel).toContainText("Uitsplitsing per vraag");
  await expect(selectedPanel).toContainText("Racewijziging");
  await expect(selectedPanel.getByRole("link", { name: "Gescoord" })).toBeVisible();
  await expect(selectedPanel.getByRole("link", { name: "Alles" })).toBeVisible();

  const selectedText = await selectedPanel.innerText();
  expect(selectedText).not.toMatch(/Strengths|Gaps above|Distinctive picks|Question breakdown|Race change|Scored questions/);
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
  const flowPreviewRow = page.locator(".home-leaderboard-preview .leaderboard-preview-row", {
    hasText: "E2E Insight Flow"
  });
  await expect(flowPreviewRow.locator(".leaderboard-preview-delta")).toHaveText("5");
  await expect(flowPreviewRow.locator(".leaderboard-preview-delta")).toHaveAttribute("data-rank-delta-direction", "up");
  const previewColumnOrder = await flowPreviewRow.locator(":scope > div").evaluateAll((nodes) =>
    nodes.map((node) => String(node.className).split(/\s+/)[0])
  );
  expect(previewColumnOrder).toEqual([
    "leaderboard-preview-rank",
    "leaderboard-preview-delta",
    "leaderboard-preview-name",
    "leaderboard-preview-points"
  ]);
  await expect(flowPreviewRow.locator(".leaderboard-preview-points")).not.toBeEmpty();
  await previewLinks.first().click();

  await expect(page).toHaveURL(/\/global\/leaderboard/);
  await expect(page.getByRole("heading", { name: /Global: Leaderboard/i })).toBeVisible();
  await expect(page.locator("form[action='/login']")).toHaveCount(0);
});

test("dashboard previews Global answers as podium picks and keeps phone layout compact", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  seedLeaderboardInsights(db);
  seedGlobalDashboardAnswers(db);
  db.close();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard");

  const card = page.locator(".dashboard-global-answers-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Your Global top 3");
  await expect(card.locator(".dashboard-global-position-link")).toContainText(/Position \d+ of \d+/);
  await expect(card.getByRole("link", { name: "View all answers" })).toHaveAttribute(
    "href",
    "/global/responses"
  );

  const driverPanel = card.locator('[data-dashboard-answer-question="drivers_championship_top_3"]');
  await expect(driverPanel).toContainText("Drivers' Championship");
  const driverPositionOrder = await driverPanel.locator(".dashboard-podium-pick").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-position"))
  );
  expect(driverPositionOrder).toEqual(["2", "1", "3"]);
  await expect(driverPanel.locator('[data-position="1"]')).toContainText("Lewis Hamilton");
  await expect(driverPanel.locator('[data-position="2"]')).toContainText("Max Verstappen");
  await expect(driverPanel.locator('[data-position="3"]')).toContainText("Kimi Antonelli");

  const constructorPanel = card.locator('[data-dashboard-answer-question="constructors_championship_top_3"]');
  await expect(constructorPanel.locator('[data-position="1"]')).toContainText("Ferrari");
  await expect(constructorPanel.locator('[data-position="2"]')).toContainText("McLaren");
  await expect(page.locator(".dashboard-desktop-global-preview")).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const mobileCard = page.locator(".dashboard-global-answers-card");
  await expect(mobileCard).toBeVisible();
  await expect(mobileCard.locator(".dashboard-global-position-link")).toContainText(/Position \d+ of \d+/);
  await expect(mobileCard.locator('a[href="/global/leaderboard"]').first()).toBeVisible();
  await expect(page.locator(".dashboard-desktop-global-preview")).toBeHidden();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);
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
      chartWrapWidth: Math.round(document.querySelector(".leaderboard-chart-wrap").getBoundingClientRect().width),
      chartWrapRight: Math.round(document.querySelector(".leaderboard-chart-wrap").getBoundingClientRect().right),
      chartWrapBottom: Math.round(document.querySelector(".leaderboard-chart-wrap").getBoundingClientRect().bottom),
      chartSvgHeight: Math.round(document.querySelector(".leaderboard-trend-chart").getBoundingClientRect().height),
      snapshotWidth: Math.round(document.querySelector(".leaderboard-snapshot-form").getBoundingClientRect().width),
      tableWidth: Math.round(document.querySelector(".leaderboard-main-card table").getBoundingClientRect().width),
      legendLeft: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().left),
      legendTop: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().top),
      legendWidth: Math.round(document.querySelector(".leaderboard-chart-legend").getBoundingClientRect().width),
      mainHeight: Math.round(document.querySelector(".leaderboard-main-column").getBoundingClientRect().height),
      checkedControls: document.querySelectorAll(".leaderboard-chart-legend input[type='checkbox']:checked").length,
      detailTop: Math.round(document.querySelector(".leaderboard-detail-card").getBoundingClientRect().top),
      positionColumnWidth: Math.round(document.querySelector(".leaderboard-main-card tbody td:first-child").getBoundingClientRect().width),
      pointsTextAlign: getComputedStyle(document.querySelector(".leaderboard-main-card tbody td:nth-child(3)")).textAlign,
      deltaFontSize: Number.parseFloat(getComputedStyle(document.querySelector(".leaderboard-position-delta")).fontSize)
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
      expect(metrics.legendWidth).toBeGreaterThanOrEqual(150);
      expect(metrics.legendWidth).toBeLessThanOrEqual(230);
      expect(metrics.chartWrapWidth).toBeGreaterThan(metrics.legendWidth * 3);
      expect(metrics.chartSvgHeight).toBeGreaterThanOrEqual(250);
      expect(metrics.chartBottom).toBeLessThanOrEqual(metrics.mainTop);
      expect(metrics.detailLeft).toBeGreaterThanOrEqual(metrics.mainRight);
      expect(metrics.mainWidth).toBeGreaterThanOrEqual(420);
      expect(metrics.mainWidth).toBeLessThanOrEqual(500);
      expect(metrics.detailWidth / metrics.mainWidth).toBeGreaterThanOrEqual(1.2);
      expect(Math.abs(metrics.detailTop - metrics.mainTop)).toBeLessThanOrEqual(8);
      expect(Math.abs(metrics.snapshotWidth - metrics.tableWidth)).toBeLessThanOrEqual(2);
      expect(metrics.positionColumnWidth).toBeGreaterThanOrEqual(74);
    } else {
      expect(metrics.legendTop).toBeGreaterThanOrEqual(metrics.chartWrapBottom);
      expect(metrics.mainTop).toBeGreaterThanOrEqual(metrics.chartBottom);
      expect(metrics.detailTop).toBeGreaterThanOrEqual(metrics.mainTop);
      expect(metrics.snapshotWidth).toBeLessThanOrEqual(metrics.mainWidth);
    }
    expect(metrics.pointsTextAlign).toBe("center");
    expect(metrics.deltaFontSize).toBeLessThanOrEqual(9);
    expect(metrics.checkedControls).toBeGreaterThan(0);
  }
});
