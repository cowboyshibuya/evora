import { defineConfig } from "@playwright/test";
import applicationTests from "../playwright.config.ts";

// These checks run during Workers Builds without installing a browser.
export default defineConfig({
  ...applicationTests,
  testDir: ".",
  testMatch: ["domain.spec.ts", "migrations.spec.ts", "deployment.spec.ts"],
  webServer: undefined,
  reporter: "list",
  outputDir: "../test-results/unit",
});
