import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const backendPort = Number(process.env.CVN_E2E_BACKEND_PORT ?? 8011);
const frontendPort = Number(process.env.CVN_E2E_FRONTEND_PORT ?? 5174);
const e2eRoot = process.env.CVN_E2E_ROOT ?? join(tmpdir(), "channel-vault-nas-e2e");
const databasePath = join(e2eRoot, "metadata", "app.db");
const archiveDir = join(e2eRoot, "archive");
const metadataDir = join(e2eRoot, "metadata");
const runtimeEnvFile = join(e2eRoot, "runtime.env");
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const pythonBin = process.env.CVN_E2E_PYTHON ?? "../backend/.venv/bin/python";

function sh(value: string) {
  return JSON.stringify(value);
}

const backendCommand = [
  `PYTHON_BIN=${sh(pythonBin)}`,
  `rm -f ${sh(runtimeEnvFile)}`,
  `CVN_E2E_DB_PATH=${sh(databasePath)} CVN_E2E_ARCHIVE_DIR=${sh(archiveDir)} "$PYTHON_BIN" ../backend/scripts/seed_e2e.py`,
  `cd ../backend && ${[
    `CVN_DATABASE_URL=${sh(`sqlite+aiosqlite:///${databasePath}`)}`,
    `CVN_DOWNLOAD_DIR=${sh(archiveDir)}`,
    `CVN_METADATA_DIR=${sh(metadataDir)}`,
    `CVN_RUNTIME_ENV_FILE=${sh(runtimeEnvFile)}`,
    "CVN_DB_BACKUP_ON_STARTUP=false",
    "CVN_DB_MIGRATE_ON_STARTUP=false",
    `CVN_CORS_ORIGINS=${sh(JSON.stringify([frontendUrl, `http://localhost:${frontendPort}`]))}`,
    `"$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}`,
  ].join(" ")}`,
].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    locale: "ko-KR",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: backendCommand,
      url: `${backendUrl}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `VITE_API_BASE_URL=${sh(backendUrl)} npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
