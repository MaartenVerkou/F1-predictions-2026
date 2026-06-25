"use strict";

const { expect, test } = require("@playwright/test");

async function switchToVisitor(page) {
  await page.goto("/");
  const csrfToken = await page.locator('form[action="/dev/switch-user"] input[name="_csrf"]').first().inputValue();
  await page.request.post("/dev/switch-user", {
    form: {
      _csrf: csrfToken,
      mode: "visitor",
      redirectTo: "/"
    }
  });
}

test("Named Guest can join with a Recovery PIN and return from a fresh browser", async ({ browser, page }) => {
  const groupName = `Browser Claim ${Date.now()}`;
  const guestName = `Browser Guest ${Date.now()}`;
  const claimPin = "4789";

  await page.goto("/dashboard");
  await page.locator('#create-group input[name="name"]').fill(groupName);
  await page.locator('#create-group select[name="visibility"]').selectOption("public");
  await Promise.all([
    page.waitForURL(/\/groups\/\d+$/),
    page.getByRole("button", { name: "Create group" }).click()
  ]);

  const inviteUrl = await page.locator("#invite-link").getAttribute("data-copy-value");
  expect(inviteUrl).toContain("/join/");
  const invitePath = new URL(inviteUrl).pathname;

  await switchToVisitor(page);
  await page.goto(invitePath);
  await page.locator('input[name="guestName"]').fill(guestName);
  await expect(page.locator("[data-join-start-step]")).toBeVisible();
  await expect(page.locator("[data-join-recovery-step]")).toBeHidden();
  await expect(page.locator("[data-guest-recovery-fields]")).toBeHidden();
  await expect(page.locator("[data-create-account-link]").first()).toHaveAttribute("href", /name=Browser\+Guest/);
  await page.locator("[data-show-guest-recovery]").click();
  await expect(page.locator("[data-join-start-step]")).toBeHidden();
  await expect(page.locator("[data-join-recovery-step]")).toBeVisible();
  await expect(page.locator("[data-guest-recovery-title]")).toContainText(`Verification to return as ${guestName}`);
  await expect(page.locator("[data-guest-recovery-summary]")).toContainText("Choose how you can return safely later.");
  await expect(page.locator("[data-remember-device]")).toBeChecked();
  await expect(page.locator("[data-guest-device-note]")).toContainText("Keep this guest available in this browser.");
  await page.locator("[data-remember-device-help]").hover();
  await expect(page.locator("[data-remember-device-tooltip]")).toBeVisible();
  await expect(page.locator("[data-remember-device-tooltip]")).toContainText("without recovery for about 30 days");
  await expect(page.locator("[data-join-recovery-step] [data-create-account-link]")).toContainText("Create account instead");
  await expect(page.locator("[data-guest-recovery-fields]")).toBeVisible();
  await expect(page.locator("[data-claim-pin-fields]")).toBeVisible();
  await expect(page.locator(".join-guest-pin-control")).toBeVisible();
  await expect(page.locator('input[name="claimPin"]')).toHaveAttribute("autocomplete", "one-time-code");
  await expect(page.locator("#join-guest-pin-hint")).toContainText("4 to 6 digits");
  await expect(page.locator("[data-claim-passphrase-fields]")).toBeHidden();
  await page.locator('input[name="claimSecretMode"][value="passphrase"]').check({ force: true });
  await expect(page.locator("[data-claim-pin-fields]")).toBeHidden();
  await expect(page.locator("[data-claim-passphrase-fields]")).toBeVisible();
  await expect(page.locator(".join-guest-answer-field")).toBeVisible();
  await page.locator('input[name="claimSecretMode"][value="pin"]').check({ force: true });
  await expect(page.locator("[data-claim-pin-fields]")).toBeVisible();
  await expect(page.locator("[data-claim-passphrase-fields]")).toBeHidden();
  await page.locator("[data-skip-recovery-secret]").check({ force: true });
  await expect(page.locator("[data-recovery-method-grid]")).toBeHidden();
  await expect(page.locator("[data-claim-pin-fields]")).toBeHidden();
  await expect(page.locator("[data-claim-passphrase-fields]")).toBeHidden();
  await page.locator("[data-skip-recovery-secret]").uncheck({ force: true });
  await expect(page.locator("[data-recovery-method-grid]")).toBeVisible();
  await expect(page.locator("[data-claim-pin-fields]")).toBeVisible();
  await page.locator('input[name="claimPin"]').fill(claimPin);
  await page.locator("[data-submit-guest]").click();
  await expect(page.locator("body")).toContainText(groupName);
  await expect(page.locator("body")).toContainText(guestName);
  await expect(page.getByRole("link", { name: "Compare your answers" })).toBeVisible();

  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const returningPage = await context.newPage();
  await switchToVisitor(returningPage);
  await returningPage.goto(`${invitePath}?mode=returning`);
  await expect(returningPage.locator('select[name="returnGuestId"]')).toContainText(guestName);
  await returningPage.locator('select[name="returnGuestId"]').selectOption({ label: guestName });

  await returningPage.locator('input[name="claimSecret"]').fill("0000");
  await returningPage.getByRole("button", { name: "Continue as guest" }).click();
  await expect(returningPage.locator("[data-join-error]")).toContainText("That guest and recovery answer do not match.");

  await returningPage.locator('input[name="claimSecret"]').fill(claimPin);
  await returningPage.getByRole("button", { name: "Continue as guest" }).click();
  await expect(returningPage.locator("body")).toContainText(groupName);
  await expect(returningPage.getByRole("link", { name: "Compare your answers" })).toBeVisible();
  await context.close();
});
