import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import applicationConfig from "../vite.config.ts";

export default defineConfig(({ command }) => {
  if (command !== "serve") throw new Error("The E2E config is for tests only.");
  return mergeConfig(applicationConfig, {
    server: { host: "127.0.0.1", port: 3001, strictPort: true },
    plugins: [
      {
        name: "evora-e2e-oauth-boundary",
        enforce: "pre",
        resolveId(source: string, importer?: string) {
          if (source === "./auth" && importer?.endsWith("/src/server/api.ts"))
            return fileURLToPath(new URL("./auth-fixture.ts", import.meta.url));
        },
      },
    ],
  });
});
