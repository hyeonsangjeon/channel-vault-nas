import { expect, test } from "@playwright/test";

test.skip(process.env.CVN_E2E_SKIP_SEED !== "true", "Set CVN_E2E_SKIP_SEED=true to test the empty first-run demo flow.");

test("empty first run can load the safe demo workspace", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
    localStorage.removeItem("cvn.authToken");
  });

  await page.goto("/");

  const firstRun = page.getByLabel("첫 소스 빈 상태");
  await expect(firstRun).toBeVisible();
  await expect(firstRun).toContainText("안전 데모 불러오기");
  const cleanInstallGate = firstRun.getByLabel("클린 설치 beta gate");
  await expect(cleanInstallGate).toContainText("첫 실제 아카이브 전에 5가지만 확인");
  await expect(cleanInstallGate).toContainText("접근 보호");
  await expect(cleanInstallGate).toContainText("마운트 확인");
  await expect(cleanInstallGate).toContainText("복구 계획");
  await expect(cleanInstallGate).toContainText("진단 복사");
  await cleanInstallGate.getByRole("button", { name: "진단 복사" }).click();
  await expect(cleanInstallGate.getByRole("button", { name: "번들 복사됨" })).toBeVisible();

  await cleanInstallGate.getByRole("button", { name: "데모 불러오기" }).click();

  await expect(page.locator(".channel-switcher")).toContainText("Signal Lab");
  const tabs = page.getByLabel("채널 상세 탭");
  await expect(tabs.getByRole("button", { name: "다운로드" })).toHaveClass(/active/);
  await expect(page.getByText("안전 데모 워크스페이스")).toBeVisible();
  await expect(page.getByText("다운로드 파동을 드라이런")).toBeVisible();
  await expect(page.getByText(/Signal Lab 데모를 불러왔습니다/)).toBeVisible();

  await page.getByRole("button", { name: "데모 제거" }).click();

  await expect(page.getByText(/Signal Lab 데모를 정리했습니다/)).toBeVisible();
  await expect(page.getByLabel("첫 소스 빈 상태")).toBeVisible();
  await expect(page.getByText("안전 데모 워크스페이스")).toHaveCount(0);
});
