"use strict";

const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const stateDir = path.join(__dirname, ".tmp", "playwright-state");

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "node server.js",
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    env: {
      NODE_ENV: "test",
      PORT: String(PORT),
      DATA_DIR: stateDir,
      DB_PATH: path.join(stateDir, "app.db"),
      QUESTIONS_PATH: path.join(__dirname, "data", "questions.json"),
      ROSTER_PATH: path.join(__dirname, "data", "roster.json"),
      RACES_PATH: path.join(__dirname, "data", "races.json"),
      LAST_SEASON_RESULTS_PATH: path.join(__dirname, "data", "last-season-results.json"),
      SESSION_SECRET: "playwright-session-secret",
      LOG_LEVEL: "warn",
      ADMIN_EMAILS: "dev@example.com",
      DEV_AUTO_LOGIN: "1",
      DEV_AUTO_LOGIN_EMAIL: "dev@example.com",
      DEV_AUTO_LOGIN_NAME: "Dev Admin"
    }
  }
});
