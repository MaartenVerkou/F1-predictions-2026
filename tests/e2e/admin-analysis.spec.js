"use strict";

const { expect, test } = require("@playwright/test");

test("admin sim200 analysis opens the simulated leaderboard", async ({ page }) => {
  await page.goto("/admin/analysis");

  const groupName = `E2E Sim Leaderboard ${Date.now()}`;
  await page.getByLabel("Group name").fill(groupName);
  await page.getByLabel("Fake players").fill("8");
  await page.getByRole("button", { name: "Create test group" }).click();

  const groupRow = page.locator(".admin-analysis-groups-table tbody tr", {
    hasText: groupName
  });
  await expect(groupRow).toBeVisible();

  await groupRow.getByRole("link", { name: "Analyze 200 seasons" }).click();
  await expect(page.getByRole("heading", { name: "Test group analysis" })).toBeVisible();
  await expect(page.locator("body")).toContainText("Monte Carlo over");

  await page.getByRole("link", { name: "Open leaderboard" }).click();
  await expect(page).toHaveURL(/\/admin\/analysis\/\d+\/leaderboard\?mode=sim200/);
  await expect(page.getByRole("heading", { name: new RegExp(`${groupName}.*Leaderboard`) })).toBeVisible();
  await expect(page.locator(".leaderboard-main-card tbody tr").first()).toBeVisible();
  await expect.poll(async () => page.locator(".leaderboard-main-card tbody tr").count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator(".leaderboard-position-delta")).toHaveCount(0);
});
