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

  return { devAdminId: Number(devAdmin.id) };
}

test("leaderboard shows trend chart, latest-race movement, selected insights, and breakdown modes", async ({ page }) => {
  await page.goto("/");

  const db = new Database(DB_PATH);
  const { devAdminId } = seedLeaderboardInsights(db);
  db.close();

  await page.goto("/global/leaderboard");

  await expect(page.getByText(/Live scoring reflects/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Points over rounds/i })).toBeVisible();
  await expect(page.locator(".leaderboard-trend-chart")).toBeVisible();
  await expect(page.locator(".leaderboard-main-card thead")).toContainText("CHANGE");
  const flowRow = page.locator(".leaderboard-main-card tbody tr", { hasText: "E2E Insight Flow" });
  await expect(flowRow.locator(".leaderboard-delta-cell")).toHaveText("+5");
  await expect(page.locator(".leaderboard-chart-legend")).toContainText("Dev Admin");

  const selectedPanel = page.locator(".leaderboard-selected-panel");
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
  await expect(selectedPanel.locator(".leaderboard-selected-metrics")).toContainText("+15 pts");
  await expect(selectedPanel.locator(".leaderboard-selected-metrics")).toContainText("steady");

  await selectedPanel.getByRole("link", { name: "Scored" }).click();
  await expect(page.locator("#leaderboard-breakdown tbody tr")).toHaveCount(3);
  await expect(page.locator("#leaderboard-breakdown tbody tr.is-unscored")).toHaveCount(0);
});
