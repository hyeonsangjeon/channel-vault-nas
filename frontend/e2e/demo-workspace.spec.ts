import { expect, test } from "@playwright/test";

test.skip(process.env.CVN_E2E_SKIP_SEED !== "true", "Set CVN_E2E_SKIP_SEED=true to test the empty first-run demo flow.");

test("empty first run leads with the simple registration flow", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
    localStorage.removeItem("cvn.authToken");
  });

  await page.goto("/");

  const home = page.locator(".simple-home");
  await expect(home.getByRole("heading", { name: "내 채널을 자동으로 안전하게 보관하세요" })).toBeVisible();
  await expect(home.locator(".simple-home-step")).toHaveCount(3);
  await expect(home).toContainText("채널 주소 붙여넣기");
  await expect(home).toContainText("일정 선택하기");
  await expect(home).toContainText("자동 백업 시작");

  const registrationPanel = home.locator(".channel-registration-panel");
  await expect(registrationPanel.getByLabel("채널 URL 또는 ID")).toBeVisible();
  await expect(registrationPanel.getByRole("button", { name: "채널 확인" })).toBeVisible();
  await expect(page.locator(".simple-home")).toBeVisible();
  await expect(page.locator(".launch-runway-step")).toHaveCount(0);
});
