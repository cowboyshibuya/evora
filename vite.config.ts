import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { host: "0.0.0.0", port: 3000, allowedHosts: true },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // Keep local D1/R2 data in the existing directory after the v2 upgrade.
      persistState: { path: ".wrangler/state" },
      remoteBindings: false,
      types: { includeRuntime: false },
    }),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
});
