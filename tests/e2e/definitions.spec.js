"use strict";

const { expect, test } = require("@playwright/test");

test("public definitions page is backed by the shared catalog", async ({ page }) => {
  await page.goto("/definitions");
  await expect(page.locator("h1")).toHaveText("Definitions");
  await expect(page.locator(".public-definitions-table tbody tr")).toHaveCount(10);
  await expect(page.locator(".public-definitions-table")).toContainText("Grand Prix podiums only.");
});

test("admin Inputs exposes the definitions tab and protected edit form", async ({ page }) => {
  await page.goto("/admin/inputs?tab=definitions&season=2026");
  await expect(page.locator(".admin-inputs-tabs .admin-race-data-tab.is-active")).toHaveText("Definitions");
  await page.getByRole("link", { name: "Edit data" }).click();
  await expect(page.locator("#definition-form-1")).toBeAttached();
  await expect(page.locator('input[name="term_key"][form="definition-form-1"]')).toHaveValue("dnf");
});
