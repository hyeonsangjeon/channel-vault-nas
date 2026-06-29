import { expect, test } from "@playwright/test";

test.skip(process.env.CVN_E2E_SKIP_SEED !== "true", "Set CVN_E2E_SKIP_SEED=true to test the empty first-run demo flow.");

test("empty first run leads with the first backup wizard and can still load the safe demo workspace", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "ko");
    localStorage.removeItem("cvn.authToken");
  });

  await page.goto("/");

  const firstRun = page.getByLabel("첫 채널 백업");
  await expect(firstRun).toBeVisible();
  await expect(firstRun).toContainText("첫 채널 백업 시작");
  await expect(firstRun).toContainText("채널 분석");
  await expect(firstRun).toContainText("마지막 확인 창에서 승인하기 전에는 아무것도 다운로드하지 않습니다");
  await expect(firstRun).toContainText("안전 데모와 고급 가져오기 옵션");
  await expect(firstRun).toContainText("운영 점검");
  await expect(firstRun.getByLabel("클린 설치 점검")).toHaveCount(0);

  await firstRun.getByRole("button", { name: /운영 점검/ }).click();
  const cleanInstallGate = firstRun.getByLabel("클린 설치 점검");
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
  await expect(page.getByText("다운로드 묶음 미리보기")).toBeVisible();
  await expect(page.getByText(/Signal Lab 데모를 불러왔습니다/)).toBeVisible();

  await page.getByRole("button", { name: "데모 제거" }).click();

  await expect(page.getByText(/Signal Lab 데모를 정리했습니다/)).toBeVisible();
  const resetFirstRun = page.getByLabel("첫 채널 백업");
  await expect(resetFirstRun).toBeVisible();
  await expect(resetFirstRun).toContainText("첫 채널 백업 시작");
});
