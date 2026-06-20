import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load the gitignored runtime secrets so the test dev server can reach the dedicated DB + auth.
dotenv.config({ path: "infra/tradevault-db.env" });

const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const deviceUse = {
  "desktop-light": { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, colorScheme: "light" as const },
  "desktop-dark": { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, colorScheme: "dark" as const },
  "mobile-light": { ...devices["Pixel 7"], colorScheme: "light" as const },
  "mobile-dark": { ...devices["Pixel 7"], colorScheme: "dark" as const },
};

const deviceProjects = Object.entries(deviceUse).map(([name, use]) => ({
  name,
  use,
  dependencies: ["setup"],
  teardown: "teardown",
  testIgnore: /auth\.(setup|teardown)\.ts/,
}));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "line",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    // The gated app needs a DB + auth; point the dev server at the dedicated Postgres.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "",
      BETTER_AUTH_URL: BASE_URL,
      PATH: process.env.PATH ?? "",
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "teardown", testMatch: /auth\.teardown\.ts/ },
    ...deviceProjects,
  ],
});
