import { expect, test } from "@playwright/test";

const token = process.env.CVN_E2E_AUTH_TOKEN ?? "";

test.skip(!token, "Set CVN_E2E_AUTH_TOKEN to run the optional auth gate smoke.");

test("operator token gate unlocks a protected NAS console", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
    if (!sessionStorage.getItem("cvn.authGateSmokeReady")) {
      localStorage.removeItem("cvn.authToken");
      sessionStorage.setItem("cvn.authGateSmokeReady", "true");
    }
  });

  await page.goto("/");

  const gate = page.getByLabel("NAS 접근 토큰 게이트");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("접근 토큰이 필요합니다.");
  await expect(gate).toContainText("토큰이 없거나 올바르지 않아");

  await gate.getByPlaceholder("CVN_AUTH_TOKEN 붙여넣기").fill(token);
  await gate.getByRole("button", { name: "콘솔 열기" }).click();

  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
  await expect(page.getByLabel("오늘의 아카이브 미션")).toContainText("준비도");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cvn.authToken")))
    .toBe(token);
});
