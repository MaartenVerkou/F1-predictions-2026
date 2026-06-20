"use strict";

const { expect, test } = require("@playwright/test");

const measureHeaderBootstrap = async (page, width) => {
  let releaseApp;
  let resolveAppRequested;
  const appRequested = new Promise((resolve) => {
    resolveAppRequested = resolve;
  });
  const appRelease = new Promise((resolve) => {
    releaseApp = resolve;
  });

  await page.setViewportSize({ width, height: 844 });
  await page.route("**/app.js*", async (route) => {
    resolveAppRequested();
    await appRelease;
    await route.continue();
  });

  await page.goto("/dashboard", { waitUntil: "commit" });
  await appRequested;
  await page.waitForSelector("header", { state: "attached" });
  await page.waitForFunction(() => getComputedStyle(document.body).paddingTop !== "0px");

  const beforeApp = await page.evaluate(() => {
    const main = document.querySelector("main").getBoundingClientRect();
    return {
      mainTop: Math.round(main.top),
      menuDisplay: getComputedStyle(document.querySelector("[data-header-menu]")).display
    };
  });

  releaseApp();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(50);

  const afterApp = await page.evaluate(() => {
    const main = document.querySelector("main").getBoundingClientRect();
    return {
      mainTop: Math.round(main.top),
      menuDisplay: getComputedStyle(document.querySelector("[data-header-menu]")).display
    };
  });

  return { beforeApp, afterApp };
};

const measureHeaderAnchor = async (page, path) => {
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForSelector(".countdown", { state: "visible" });

  return page.evaluate(() => {
    const header = document.querySelector("header");
    const inner = document.querySelector(".header-inner");
    const countdown = document.querySelector(".countdown");
    const main = document.querySelector("main");
    const headerRect = header.getBoundingClientRect();
    const innerRect = inner.getBoundingClientRect();
    const countdownRect = countdown.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();

    return {
      headerClass: header.className,
      headerLeft: Math.round(headerRect.left),
      headerWidth: Math.round(headerRect.width),
      innerLeft: Math.round(innerRect.left),
      innerWidth: Math.round(innerRect.width),
      innerCenterX: Math.round(innerRect.left + innerRect.width / 2),
      countdownCenterX: Math.round(countdownRect.left + countdownRect.width / 2),
      countdownTop: Math.round(countdownRect.top),
      mainTop: Math.round(mainRect.top),
      viewportWidth: document.documentElement.clientWidth,
      bodyWidth: Math.round(document.body.getBoundingClientRect().width),
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter,
      overflowY: getComputedStyle(document.documentElement).overflowY
    };
  });
};

const measureHeaderOverlap = async (page, width) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.waitForSelector(".countdown", { state: "visible" });

  return page.evaluate(() => {
    const readRect = (selector) => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        text: element.textContent.trim().replace(/\s+/g, " ")
      };
    };

    const brand = readRect(".header-brand");
    const countdown = readRect(".countdown");
    const toggle = readRect("[data-header-menu-toggle]");
    const actions = readRect("[data-header-menu]");
    const rightEdge = toggle.width > 0 ? toggle.left : actions.left;

    return {
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      headerClass: document.querySelector("header").className,
      brand,
      countdown,
      toggle,
      actions,
      brandCountdownGap: countdown.left - brand.right,
      countdownRightGap: rightEdge - countdown.right
    };
  });
};

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

test("countdown header anchor stays stable across admin content pages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  const analysis = await measureHeaderAnchor(page, "/admin/testing");
  const ideas = await measureHeaderAnchor(page, "/admin/ideas");

  expect(analysis.headerClass).not.toContain("is-center-hidden");
  expect(ideas.headerClass).not.toContain("is-center-hidden");
  expect(Math.abs(analysis.countdownCenterX - analysis.innerCenterX)).toBeLessThanOrEqual(1);
  expect(Math.abs(ideas.countdownCenterX - ideas.innerCenterX)).toBeLessThanOrEqual(1);
  expect(Math.abs(analysis.countdownCenterX - ideas.countdownCenterX)).toBeLessThanOrEqual(1);
  expect(Math.abs(analysis.countdownTop - ideas.countdownTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(analysis.mainTop - ideas.mainTop)).toBeLessThanOrEqual(1);
  expect(analysis.innerLeft).toBe(ideas.innerLeft);
  expect(analysis.innerWidth).toBe(ideas.innerWidth);
  expect(analysis.viewportWidth).toBe(ideas.viewportWidth);
  expect(analysis.bodyWidth).toBe(ideas.bodyWidth);
  expect(analysis.overflowY).toBe("scroll");
  expect(analysis.scrollbarGutter).toContain("stable");
});

test("header reserves the same page offset before app bootstrap", async ({ page }) => {
  const desktop = await measureHeaderBootstrap(page, 1280);
  expect(Math.abs(desktop.afterApp.mainTop - desktop.beforeApp.mainTop)).toBeLessThanOrEqual(2);
  expect(desktop.beforeApp.menuDisplay).toBe("flex");

  const compactTimerPage = await page.context().newPage();
  const compactTimer = await measureHeaderBootstrap(compactTimerPage, 990);
  expect(Math.abs(compactTimer.afterApp.mainTop - compactTimer.beforeApp.mainTop)).toBeLessThanOrEqual(2);
  expect(compactTimer.beforeApp.menuDisplay).toBe("flex");
  await compactTimerPage.close();

  const mobilePage = await page.context().newPage();
  const mobile = await measureHeaderBootstrap(mobilePage, 390);
  expect(Math.abs(mobile.afterApp.mainTop - mobile.beforeApp.mainTop)).toBeLessThanOrEqual(2);
  expect(mobile.beforeApp.menuDisplay).toBe("none");
  await mobilePage.close();
});

test("closed countdown stays between brand and header actions on narrow screens", async ({ page }) => {
  await page.request.post("/language", {
    form: {
      locale: "nl",
      redirectTo: "/dashboard"
    }
  });

  for (const width of [980, 720, 600, 460, 420, 390, 360, 320]) {
    const metrics = await measureHeaderOverlap(page, width);

    expect(metrics.brandCountdownGap, JSON.stringify(metrics)).toBeGreaterThanOrEqual(8);
    expect(metrics.countdownRightGap, JSON.stringify(metrics)).toBeGreaterThanOrEqual(8);
    expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.viewportWidth);
  }
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

test("header theme polish keeps language menu, dark logo, and Dutch closed countdown stable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.request.post("/language", {
    form: {
      locale: "nl",
      redirectTo: "/dashboard"
    }
  });

  await page.goto("/dashboard");
  await expect(page.locator(".countdown-value")).toContainText("Voorspellingen gesloten");

  const closedCountdown = await page.locator(".countdown").evaluate((element) => {
    const value = element.querySelector(".countdown-value");
    return {
      label: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      text: value.textContent.trim(),
      valueWidth: Math.ceil(value.getBoundingClientRect().width),
      valueScrollWidth: value.scrollWidth
    };
  });
  expect(closedCountdown.label).toBe("Voorspellingen zijn gesloten!");
  expect(closedCountdown.title).toBe("Voorspellingen zijn gesloten!");
  expect(closedCountdown.text).toBe("Voorspellingen gesloten");
  expect(closedCountdown.valueScrollWidth).toBeLessThanOrEqual(closedCountdown.valueWidth + 1);

  await page.locator(".lang-menu > summary").click();
  const dutchOption = page.locator(".lang-option.is-active");
  await dutchOption.hover();
  const lightLanguageStyle = await dutchOption.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      transform: style.transform
    };
  });
  expect(lightLanguageStyle.backgroundColor).not.toContain("214, 11, 34");
  expect(lightLanguageStyle.backgroundColor).not.toContain("185, 8, 28");
  expect(lightLanguageStyle.boxShadow).toBe("none");
  expect(lightLanguageStyle.transform).toBe("none");

  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });
  await page.goto("/dashboard");
  await expect(page.locator(".brand-logo-dark")).toBeVisible();
  await page.locator(".lang-menu > summary").click();
  await dutchOption.hover();

  const darkLanguageStyle = await dutchOption.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      transform: style.transform
    };
  });
  expect(darkLanguageStyle.backgroundColor).toBe("rgba(255, 255, 255, 0.075)");
  expect(darkLanguageStyle.borderColor).toBe("rgba(255, 255, 255, 0.14)");
  expect(darkLanguageStyle.boxShadow).toBe("none");
  expect(darkLanguageStyle.transform).toBe("none");

  const darkLogoStyle = await page.locator(".brand-logo-frame").evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor
    };
  });
  expect(darkLogoStyle.backgroundColor).not.toBe("rgb(255, 255, 255)");
  expect(darkLogoStyle.backgroundColor).not.toBe("rgba(255, 255, 255, 0.95)");
  expect(darkLogoStyle.borderColor).not.toBe("rgba(15, 26, 51, 0.08)");
});
