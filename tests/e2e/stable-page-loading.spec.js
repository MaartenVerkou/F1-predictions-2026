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
    const countdownValue = document.querySelector(".countdown-value");

    return {
      fontsStatus: document.fonts?.status || "unknown",
      headerHeight: Math.round(header.getBoundingClientRect().height),
      mainTop: Math.round(main.getBoundingClientRect().top),
      headingHeight: Math.round(heading.getBoundingClientRect().height),
      countdownValueWidth: Math.round(countdownValue.getBoundingClientRect().width),
      primarySectionTop: Math.round(primarySection.getBoundingClientRect().top),
      primarySectionHeight: Math.round(primarySection.getBoundingClientRect().height),
      cls: Number((window.__stablePageLoadingCls || 0).toFixed(4)),
      shifts: window.__stablePageLoadingShifts || []
    };
  });

const visibleLogoMetrics = async (page) =>
  page.evaluate(() => {
    const logos = Array.from(document.querySelectorAll(".brand-logo"));
    const visibleLogos = logos.filter((logo) => {
      const style = getComputedStyle(logo);
      const rect = logo.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.5 &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    return {
      visibleCount: visibleLogos.length,
      visibleSrc: visibleLogos[0]?.currentSrc || visibleLogos[0]?.getAttribute("src") || "",
      logoSources: logos.map((logo) => logo.getAttribute("src") || "")
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
  expect(Math.abs(afterFonts.countdownValueWidth - beforeFonts.countdownValueWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.primarySectionTop - beforeFonts.primarySectionTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(afterFonts.primarySectionHeight - beforeFonts.primarySectionHeight)).toBeLessThanOrEqual(2);
  expect(afterFonts.cls).toBeLessThanOrEqual(0.003);
});

test("theme logo is stable before and after app bootstrap", async ({ page }) => {
  let releaseApp;
  let resolveAppRequested;
  const appRequested = new Promise((resolve) => {
    resolveAppRequested = resolve;
  });
  const appRelease = new Promise((resolve) => {
    releaseApp = resolve;
  });

  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.route("**/app.js*", async (route) => {
    resolveAppRequested();
    await appRelease;
    await route.continue();
  });

  await page.goto("/dashboard", { waitUntil: "commit" });
  await appRequested;
  await page.waitForSelector(".brand-logo", { state: "attached" });
  const beforeApp = await visibleLogoMetrics(page);

  releaseApp();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(50);
  const afterApp = await visibleLogoMetrics(page);

  expect(beforeApp.visibleCount).toBe(1);
  expect(afterApp.visibleCount).toBe(1);
  expect(beforeApp.visibleSrc).toContain("logo-header-dark-96.png");
  expect(afterApp.visibleSrc).toBe(beforeApp.visibleSrc);
  expect(afterApp.logoSources).toEqual(beforeApp.logoSources);
});

test("shared head assets are versioned and cacheable", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const assets = await page.evaluate(() => ({
    stylesheet: document.querySelector('link[rel="stylesheet"][href*="styles.css"]')?.getAttribute("href") || "",
    script: document.querySelector('script[src*="app.js"]')?.getAttribute("src") || "",
    logos: Array.from(document.querySelectorAll(".brand-logo"))
      .map((logo) => logo.getAttribute("src") || "")
      .filter(Boolean),
    logoPreloads: Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'))
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => href.includes("/assets/brand/logo-header-")),
    fontPreloads: Array.from(document.querySelectorAll('link[rel="preload"][as="font"]'))
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => href.includes("/assets/fonts/"))
  }));

  expect(assets.stylesheet).toContain("v=");
  expect(assets.script).toContain("v=");
  expect(assets.logos).toHaveLength(2);
  expect(assets.logoPreloads).toHaveLength(2);
  expect(assets.fontPreloads).toHaveLength(2);
  for (const assetUrl of [...assets.logos, ...assets.logoPreloads, ...assets.fontPreloads]) {
    expect(assetUrl).toContain("v=");
  }

  for (const assetUrl of [
    assets.stylesheet,
    assets.script,
    ...assets.logos,
    ...assets.logoPreloads,
    ...assets.fontPreloads
  ]) {
    const response = await page.request.get(assetUrl);
    expect(response.ok()).toBeTruthy();
    const cacheControl = response.headers()["cache-control"] || "";
    expect(cacheControl).toContain("max-age=31536000");
    expect(cacheControl).toContain("immutable");
  }
});
