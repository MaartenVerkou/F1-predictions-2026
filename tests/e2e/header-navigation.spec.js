"use strict";

const { expect, test } = require("@playwright/test");

test("desktop header shows dashboard and admin labels while keeping account compact", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard");

  const header = page.locator("header");
  await expect(header).not.toHaveClass(/is-collapsed/);
  await expect(header).not.toContainText("Signed in as");

  const dashboardLink = header.locator(".header-link-dashboard");
  await expect(dashboardLink).toBeVisible();
  await expect(dashboardLink.locator(".header-link-label")).toBeVisible();
  await expect(dashboardLink.locator(".header-nav-icon-dashboard")).toBeVisible();

  const adminLink = header.locator(".header-link-admin");
  const accountLink = header.locator(".header-link-account");
  await expect(adminLink).toBeVisible();
  await expect(accountLink).toBeVisible();
  await expect(adminLink.locator(".header-link-label")).toBeVisible();
  await expect(accountLink.locator(".header-link-label")).toBeHidden();
  await expect(accountLink.locator(".header-nav-icon-account")).toBeVisible();

  const iconMetrics = await page.evaluate(() =>
    [
      ".header-link-admin .header-nav-icon",
      ".header-link-dashboard .header-nav-icon",
      ".header-link-account .header-nav-icon",
      ".lang-menu > summary svg",
      ".theme-toggle .theme-icon"
    ].map((selector) => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    })
  );

  expect(iconMetrics).toEqual([
    { selector: ".header-link-admin .header-nav-icon", width: 24, height: 24 },
    { selector: ".header-link-dashboard .header-nav-icon", width: 24, height: 24 },
    { selector: ".header-link-account .header-nav-icon", width: 24, height: 24 },
    { selector: ".lang-menu > summary svg", width: 24, height: 24 },
    { selector: ".theme-toggle .theme-icon", width: 24, height: 24 }
  ]);
});

test("collapsed admin header menu orders actions and keeps dark selected state subtle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.goto("/dashboard");

  const header = page.locator("header");
  await expect(header).toHaveClass(/is-collapsed/);
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.locator("[data-header-menu]")).toHaveClass(/is-open/);

  const itemLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-header-menu] .header-action-link, [data-header-menu] .header-menu-row"))
      .filter((item) => {
        const style = window.getComputedStyle(item);
        const rect = item.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map((item) => item.textContent.trim().replace(/\s+/g, " "))
  );

  expect(itemLabels.slice(0, 5)).toEqual([
    "Admin",
    "Dashboard",
    "My account",
    "Language",
    "Light mode"
  ]);

  await page.locator(".lang-menu > summary").click();
  const activeLanguageStyle = await page.locator(".lang-option.is-active").first().evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor
    };
  });

  expect(activeLanguageStyle.color).not.toBe("rgb(255, 45, 69)");
  expect(activeLanguageStyle.backgroundColor).not.toContain("255, 45, 69");
});

test("collapsed header hover states stay neutral in light and dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");

  const toggle = page.getByRole("button", { name: "Toggle menu" });
  await toggle.hover();
  const lightToggleStyle = await toggle.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color
    };
  });
  expect(lightToggleStyle.backgroundColor).not.toContain("214, 11, 34");

  await toggle.click();
  const adminLink = page.locator(".header-link-admin");
  await adminLink.hover();
  const lightMenuStyle = await adminLink.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      textDecoration: style.textDecorationLine
    };
  });
  expect(lightMenuStyle.backgroundColor).not.toContain("214, 11, 34");
  expect(lightMenuStyle.textDecoration).toBe("none");

  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.goto("/dashboard");
  const darkToggle = page.getByRole("button", { name: "Toggle menu" });
  await darkToggle.hover();
  const darkToggleStyle = await darkToggle.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      color: style.color
    };
  });
  expect(darkToggleStyle.backgroundColor).not.toContain("255, 45, 69");
});
