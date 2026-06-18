"use strict";

const { expect, test } = require("@playwright/test");

const installLayoutShiftObserver = async (page) => {
  await page.addInitScript(() => {
    window.__stablePageLoadingCls = 0;
    window.__stablePageLoadingShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__stablePageLoadingCls += entry.value;
        window.__stablePageLoadingShifts.push({
          value: entry.value,
          sources: entry.sources?.map((source) => {
            const node = source.node;
            if (!node) return "";
            return node.className || node.tagName || "";
          }) || []
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
};

const dashboardMetrics = async (page) =>
  page.evaluate(() => {
    const header = document.querySelector("header");
    const main = document.querySelector("main");
    const heading = document.querySelector(".dashboard-my-groups-section h1");
    const primarySection = document.querySelector(".dashboard-my-groups-section");

    return {
      fontsStatus: document.fonts?.status || "unknown",
      headerHeight: Math.round(header.getBoundingClientRect().height),
      mainTop: Math.round(main.getBoundingClientRect().top),
      headingHeight: Math.round(heading.getBoundingClientRect().height),
      primarySectionTop: Math.round(primarySection.getBoundingClientRect().top),
      primarySectionHeight: Math.round(primarySection.getBoundingClientRect().height),
      cls: Number((window.__stablePageLoadingCls || 0).toFixed(4)),
      shifts: window.__stablePageLoadingShifts || []
    };
  });

test("home to dashboard navigation stays stable when font files are delayed", async ({ page }) => {
  await installLayoutShiftObserver(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.route("**/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.route("https://fonts.gstatic.com/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".dashboard-my-groups-section h1");

  const beforeFonts = await dashboardMetrics(page);
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.waitForTimeout(100);
  const afterFonts = await dashboardMetrics(page);

  expect(Math.abs(afterFonts.headerHeight - beforeFonts.headerHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.mainTop - beforeFonts.mainTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.headingHeight - beforeFonts.headingHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.primarySectionTop - beforeFonts.primarySectionTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.primarySectionHeight - beforeFonts.primarySectionHeight)).toBeLessThanOrEqual(2);
  expect(afterFonts.cls).toBeLessThanOrEqual(0.003);
});

test("shared head assets are versioned and cacheable", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const assets = await page.evaluate(() => ({
    stylesheet: document.querySelector('link[rel="stylesheet"][href*="styles.css"]')?.getAttribute("href") || "",
    script: document.querySelector('script[src*="app.js"]')?.getAttribute("src") || "",
    logo: document.querySelector(".brand-logo")?.getAttribute("src") || "",
    fontPreloads: Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'))
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => href.includes("/assets/fonts/"))
  }));

  expect(assets.stylesheet).toContain("v=");
  expect(assets.script).toContain("v=");
  expect(assets.logo).toContain("v=");
  expect(assets.fontPreloads).toHaveLength(4);
  for (const fontUrl of assets.fontPreloads) {
    expect(fontUrl).toContain("v=");
  }

  for (const assetUrl of [assets.stylesheet, assets.script, assets.logo, ...assets.fontPreloads]) {
    const response = await page.request.get(assetUrl);
    expect(response.ok()).toBeTruthy();
    const cacheControl = response.headers()["cache-control"] || "";
    expect(cacheControl).toContain("max-age=31536000");
    expect(cacheControl).toContain("immutable");
  }
});
