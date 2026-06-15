"use strict";

const { expect, test } = require("@playwright/test");

test("home page renders and health endpoint is reachable", async ({ page, request }) => {
  const health = await request.get("/healthz");
  expect(health.ok()).toBeTruthy();
  expect(health.headers()["content-type"]).toMatch(/application\/json/);

  await page.goto("/");
  await expect(page).toHaveTitle(/Wheel of Knowledge|F1/i);
  await expect(page.locator("body")).toContainText(/Wheel of Knowledge|F1/i);
});
