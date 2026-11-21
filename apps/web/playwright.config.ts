import { defineConfig, devices } from "@playwright/test";

const port = 3218;
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: `pnpm start --port ${port}`, port, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
