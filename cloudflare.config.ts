import { bindings, defineConfig } from "cf/config";
import { production } from "./config/production.ts";

export default defineConfig(({ mode, isPreview }) => {
  if (isPreview)
    throw new Error(
      "Preview deployments need separate D1 and R2 resources first.",
    );
  if (mode && mode !== "development" && mode !== "production")
    throw new Error("Use --mode development or --mode production.");
  const development = mode === "development";
  return {
    accountId: production.accountId,
    worker: {
      name: production.workerName,
      entrypoint: "@tanstack/react-start/server-entry",
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat"],
      workersDev: true,
      previewUrls: false,
      observability: {
        enabled: true,
        redactQueryString: true,
        traces: { enabled: true, headSamplingRate: 0.01 },
      },
      env: {
        DB: bindings.d1({
          name: production.databaseName,
          // Retain the original local database identity and its persisted data.
          id: development
            ? "00000000-0000-0000-0000-000000000001"
            : production.databaseId,
          dev: { remote: false },
        }),
        FILES: bindings.r2({
          name: production.bucketName,
          dev: { remote: false },
        }),
        APP_URL: bindings.text(
          development ? "http://localhost:3000" : production.appUrl,
        ),
        BETTER_AUTH_SECRET: bindings.secret(),
        GOOGLE_CLIENT_ID: bindings.secret(),
        GOOGLE_CLIENT_SECRET: bindings.secret(),
        GITHUB_CLIENT_ID: bindings.secret(),
        GITHUB_CLIENT_SECRET: bindings.secret(),
      },
    },
  };
});
