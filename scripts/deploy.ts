import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { production } from "../config/production.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildDirectory = resolve(root, ".cloudflare/output/v0");
type CommandRunner = (args: string[], capture?: boolean) => string;

function runCf(args: string[], capture = false): string {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/cf/bin/cf"), ...args],
    {
      cwd: root,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: production.accountId,
        CF_SEND_TELEMETRY: "false",
      },
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Cloudflare ${args.slice(0, 3).join(" ")} failed; deployment stopped.`,
    );
  return result.stdout || "";
}

export function deployProduction({
  run = runCf,
  environment = process.env,
  outputDirectory = buildDirectory,
}: {
  run?: CommandRunner;
  environment?: NodeJS.ProcessEnv;
  outputDirectory?: string;
} = {}) {
  if (
    environment.CLOUDFLARE_ACCOUNT_ID &&
    environment.CLOUDFLARE_ACCOUNT_ID !== production.accountId
  )
    throw new Error(
      "The Cloudflare account does not match config/production.ts.",
    );
  if (environment.CI && environment.CI !== "false") {
    const branch =
      environment.WORKERS_CI_BRANCH ||
      (environment.GITHUB_EVENT_NAME === "push"
        ? environment.GITHUB_REF_NAME
        : undefined);
    if (branch !== production.branch)
      throw new Error(
        `Production deployments are only allowed from ${production.branch}.`,
      );
  }

  // Check the compiled target before running any remote database operation.
  // A development or preview artifact must never reach production migrations.
  z.object({
    accountId: z.literal(production.accountId),
    buildContext: z.object({
      mode: z.literal("production"),
      isPreview: z.literal(false),
    }),
  }).parse(
    JSON.parse(readFileSync(resolve(outputDirectory, "config.json"), "utf8")),
  );
  z.object({
    name: z.literal(production.workerName),
    env: z.object({
      DB: z.object({
        type: z.literal("d1"),
        id: z.literal(production.databaseId),
      }),
      FILES: z.object({
        type: z.literal("r2"),
        name: z.literal(production.bucketName),
      }),
      APP_URL: z.object({
        type: z.literal("text"),
        value: z.literal(production.appUrl),
      }),
      BETTER_AUTH_SECRET: z.object({ type: z.literal("secret") }),
    }),
  }).parse(
    JSON.parse(
      readFileSync(
        resolve(outputDirectory, "workers/default/worker.config.json"),
        "utf8",
      ),
    ),
  );

  const deploy = ["deploy", "--prebuilt", "--mode", "production"];
  const migrations = [
    production.databaseId,
    "--dir",
    "migrations",
    "--mode",
    "production",
  ];
  run([...deploy, "--dry-run"]);
  run(["d1", "migrations", "apply", ...migrations]);
  const pending = z
    .array(z.object({ Name: z.string() }))
    .parse(JSON.parse(run(["d1", "migrations", "list", ...migrations], true)));
  if (pending.length)
    throw new Error(
      "Database migrations are still pending; deployment stopped.",
    );
  run(deploy);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    deployProduction();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Production deployment failed.",
    );
    process.exitCode = 1;
  }
}
