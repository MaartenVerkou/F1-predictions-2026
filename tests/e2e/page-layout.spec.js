"use strict";

const { expect, test } = require("@playwright/test");

const getHorizontalOverflow = async (page) =>
  page.evaluate(() =>
    Math.max(
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      document.body.scrollWidth - document.body.clientWidth
    )
  );

test("account page uses a compact desktop layout and stacks cleanly on phone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/account");

  await expect(page.locator(".account-page")).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);

  const desktopMetrics = await page.evaluate(() => {
    const pageEl = document.querySelector(".account-page").getBoundingClientRect();
    const panels = Array.from(document.querySelectorAll(".account-settings-grid > .account-panel-card"))
      .map((panel) => panel.getBoundingClientRect());
    return {
      pageWidth: Math.round(pageEl.width),
      panelCount: panels.length,
      panelTops: panels.map((panel) => Math.round(panel.top)),
      panelLefts: panels.map((panel) => Math.round(panel.left))
    };
  });

  expect(desktopMetrics.pageWidth).toBeLessThanOrEqual(980);
  expect(desktopMetrics.panelCount).toBe(2);
  expect(desktopMetrics.panelTops[0]).toBe(desktopMetrics.panelTops[1]);
  expect(desktopMetrics.panelLefts[1]).toBeGreaterThan(desktopMetrics.panelLefts[0]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/account");
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);

  const mobileMetrics = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".account-settings-grid > .account-panel-card"))
      .map((panel) => panel.getBoundingClientRect());
    return {
      panelCount: panels.length,
      secondPanelBelowFirst: panels[1].top > panels[0].bottom
    };
  });

  expect(mobileMetrics.panelCount).toBe(2);
  expect(mobileMetrics.secondPanelBelowFirst).toBeTruthy();
});

test("about page stays in a readable single-column article layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about");

  await expect(page.locator(".about-page")).toBeVisible();
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);

  const desktopMetrics = await page.evaluate(() => {
    const pageEl = document.querySelector(".about-page").getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll(".about-page > .card"))
      .map((card) => card.getBoundingClientRect());
    return {
      pageWidth: Math.round(pageEl.width),
      cardWidths: cards.map((card) => Math.round(card.width)),
      stacked: cards.slice(1).every((card, index) => card.top > cards[index].bottom)
    };
  });

  expect(desktopMetrics.pageWidth).toBeLessThanOrEqual(960);
  expect(desktopMetrics.stacked).toBeTruthy();
  desktopMetrics.cardWidths.forEach((width) => {
    expect(width).toBeGreaterThan(850);
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  expect(await getHorizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page.locator(".about-page-nav .link")).toHaveCount(4);
});
