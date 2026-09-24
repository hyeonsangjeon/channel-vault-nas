import { expect, test } from "@playwright/test";

test("reconnects realtime events and reloads state after a disconnect", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("channel-vault-language", "en");
    const nativeSocket = window.WebSocket;
    const tracked = window as typeof window & { cvnSockets: WebSocket[]; cvnOpened: number };
    tracked.cvnSockets = [];
    tracked.cvnOpened = 0;
    window.WebSocket = class extends nativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        if (new URL(String(url), window.location.href).pathname !== "/ws/events") return;
        tracked.cvnSockets.push(this);
        this.addEventListener("open", () => { tracked.cvnOpened += 1; });
      }
    };
  });
  let dashboardReads = 0;
  page.on("response", (response) => {
    if (response.url().endsWith("/api/dashboard") && response.ok()) dashboardReads += 1;
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => {
    const tracked = window as typeof window & { cvnSockets: WebSocket[] };
    return tracked.cvnSockets.filter((socket) => socket.readyState === WebSocket.OPEN).length;
  })).toBe(1);
  await expect.poll(() => dashboardReads).toBeGreaterThan(0);
  const beforeReads = dashboardReads;
  const beforeConnections = await page.evaluate(() => {
    const tracked = window as typeof window & { cvnSockets: WebSocket[]; cvnOpened: number };
    const opened = tracked.cvnOpened;
    tracked.cvnSockets.find((socket) => socket.readyState === WebSocket.OPEN)?.close(4000, "reconnect regression");
    return opened;
  });
  await expect.poll(() => page.evaluate(() => (window as typeof window & { cvnOpened: number }).cvnOpened))
    .toBeGreaterThan(beforeConnections);
  await expect.poll(() => dashboardReads).toBeGreaterThan(beforeReads);
});

test("manual downloads use asynchronous acceptance and poll the persisted run", async ({ page }) => {
  const audit = {
    id: 987654321,
    channel_id: null,
    channel_title: null,
    status: "running",
    dry_run: false,
    started_count: 1,
    completed_count: 0,
    failed_count: 0,
    skipped_reason: null,
    completed_at: null as string | null,
  };
  let accepted = 0;
  let polled = 0;
  let synchronousCalls = 0;
  await page.route("**/api/jobs/downloads/worker/start", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ dry_run: false, limit: 1 });
    accepted += 1;
    await route.fulfill({ status: 202, json: audit });
  });
  await page.route("**/api/jobs/downloads/worker/summary?run_id=987654321", async (route) => {
    polled += 1;
    const completed = polled >= 2;
    await route.fulfill({ json: {
      run: {
        ...audit,
        status: completed ? "completed" : "running",
        completed_count: completed ? 1 : 0,
        completed_at: completed ? new Date().toISOString() : null,
      },
      latest_worker_jobs: [],
    } });
  });
  await page.route("**/api/jobs/downloads/worker/run-once", async (route) => {
    synchronousCalls += 1;
    await route.fulfill({ status: 500, json: { detail: "Synchronous transfer must not be used" } });
  });
  await page.goto("/");
  const result = await page.evaluate(async (modulePath) => {
    const client = await import(modulePath);
    return client.runDownloadWorkerOnce({ dry_run: false, limit: 1 });
  }, "/src/api/channels.ts");
  expect(result.completed).toBe(1);
  expect(result.failed).toBe(0);
  expect(accepted).toBe(1);
  expect(polled).toBe(2);
  expect(synchronousCalls).toBe(0);
});
