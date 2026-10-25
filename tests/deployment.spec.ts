import { test, expect } from "@playwright/test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import config from "../cloudflare.config.ts";
import { production } from "../config/production.ts";
import { deployProduction } from "../scripts/deploy.ts";

function deploymentFixture() {
  const directory = mkdtempSync(resolve(tmpdir(), "evora-deploy-"));
  const rootConfig = {
    accountId: production.accountId,
    buildContext: { mode: "production", isPreview: false },
  };
  const worker = config({ mode: "production", isPreview: false }).worker;
  const calls: string[][] = [];
  const save = () => {
    mkdirSync(resolve(directory, "workers/default"), { recursive: true });
    writeFileSync(
      resolve(directory, "config.json"),
      JSON.stringify(rootConfig),
    );
    writeFileSync(
      resolve(directory, "workers/default/worker.config.json"),
      JSON.stringify(worker),
    );
  };
  save();
  return {
    rootConfig,
    worker,
    calls,
    save,
    options: {
      outputDirectory: directory,
      environment: { CI: "true", WORKERS_CI_BRANCH: "main" },
      run: (args: string[]) => {
        calls.push(args);
        return "[]";
      },
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("deployment validates the artifact, migrates, verifies, then publishes", () => {
  const fixture = deploymentFixture();
  try {
    deployProduction(fixture.options);
    expect(fixture.calls.map((args) => args.slice(0, 3))).toEqual([
      ["deploy", "--prebuilt", "--mode"],
      ["d1", "migrations", "apply"],
      ["d1", "migrations", "list"],
      ["deploy", "--prebuilt", "--mode"],
    ]);
    expect(fixture.calls[0]).toContain("--dry-run");
    expect(fixture.calls[1]).toContain(production.databaseId);
    expect(fixture.calls[3]).not.toContain("--dry-run");
  } finally {
    fixture.cleanup();
  }
});

for (const failedStep of [0, 1, 2]) {
  test(`deployment stops when preflight step ${failedStep + 1} fails`, () => {
    const fixture = deploymentFixture();
    try {
      expect(() =>
        deployProduction({
          ...fixture.options,
          run: (args) => {
            fixture.calls.push(args);
            if (fixture.calls.length === failedStep + 1)
              throw new Error("Command failed");
            return "[]";
          },
        }),
      ).toThrow("Command failed");
      expect(fixture.calls).toHaveLength(failedStep + 1);
      expect(
        fixture.calls.some(
          (args) => args[0] === "deploy" && !args.includes("--dry-run"),
        ),
      ).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
}

test("deployment refuses a skipped migration even if the CLI exits successfully", () => {
  const fixture = deploymentFixture();
  try {
    expect(() =>
      deployProduction({
        ...fixture.options,
        run: (args, capture) => {
          fixture.calls.push(args);
          return capture ? '[{"Name":"0003_company_logos.sql"}]' : "";
        },
      }),
    ).toThrow("migrations are still pending");
    expect(fixture.calls).toHaveLength(3);
  } finally {
    fixture.cleanup();
  }
});

test("deployment rejects preview branches, foreign accounts and incorrect artifacts before remote commands", () => {
  const fixture = deploymentFixture();
  try {
    for (const environment of [
      { CI: "true", WORKERS_CI_BRANCH: "feature" },
      {
        CI: "true",
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_REF_NAME: "main",
      },
      { CLOUDFLARE_ACCOUNT_ID: "another-account" },
    ])
      expect(() =>
        deployProduction({ ...fixture.options, environment }),
      ).toThrow();

    fixture.rootConfig.buildContext.isPreview = true;
    fixture.save();
    expect(() => deployProduction(fixture.options)).toThrow();
    fixture.rootConfig.buildContext.isPreview = false;
    fixture.rootConfig.buildContext.mode = "development";
    fixture.save();
    expect(() => deployProduction(fixture.options)).toThrow();
    fixture.rootConfig.buildContext.mode = "production";
    fixture.worker.env.DB = {
      ...fixture.worker.env.DB,
      id: "another-database",
    };
    fixture.save();
    expect(() => deployProduction(fixture.options)).toThrow();
    expect(fixture.calls).toHaveLength(0);
  } finally {
    fixture.cleanup();
  }
});

test("Cloudflare config keeps development storage local and refuses production resource previews", () => {
  const development = config({ mode: "development", isPreview: false });
  expect(development.worker.env.DB).toMatchObject({
    id: "00000000-0000-0000-0000-000000000001",
    dev: { remote: false },
  });
  expect(development.worker.env.FILES).toMatchObject({
    dev: { remote: false },
  });
  expect(() => config({ mode: "production", isPreview: true })).toThrow(
    "separate D1 and R2",
  );
});

test("cf applies only pending migrations and preserves data when upgrading", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "evora-migrations-"));
  const migrationDirectory = resolve(directory, "migrations");
  mkdirSync(migrationDirectory);
  const localArgs = [
    "--local",
    "--persist-to",
    resolve(directory, "state"),
    "--mode",
    "production",
  ];
  const migrationArgs = [
    production.databaseId,
    "--dir",
    migrationDirectory,
    ...localArgs,
  ];
  const cf = (args: string[], success = true) => {
    const result = spawnSync(
      process.execPath,
      [resolve("node_modules/cf/bin/cf"), ...args],
      {
        encoding: "utf8",
        env: { ...process.env, CI: "true", CF_SEND_TELEMETRY: "false" },
      },
    );
    expect(result.status, result.stderr).toBe(success ? 0 : 1);
    return result.stdout;
  };
  try {
    for (const name of ["0001_initial.sql", "0002_invoice_numbers.sql"])
      copyFileSync(
        resolve("migrations", name),
        resolve(migrationDirectory, name),
      );
    cf(["d1", "migrations", "apply", ...migrationArgs]);
    cf([
      "d1",
      "raw",
      production.databaseId,
      "--sql",
      "INSERT INTO companies (id,name,created_at) VALUES ('retained','Existing Company','2026-10-25')",
      ...localArgs,
    ]);
    copyFileSync(
      resolve("migrations/0003_company_logos.sql"),
      resolve(migrationDirectory, "0003_company_logos.sql"),
    );
    cf(["d1", "migrations", "apply", ...migrationArgs]);
    cf(["d1", "migrations", "apply", ...migrationArgs]);
    expect(
      JSON.parse(cf(["d1", "migrations", "list", ...migrationArgs])),
    ).toEqual([]);
    const rows = JSON.parse(
      cf([
        "d1",
        "raw",
        production.databaseId,
        "--sql",
        "SELECT name,logo_key FROM companies WHERE id='retained'",
        ...localArgs,
      ]),
    );
    expect(JSON.stringify(rows)).toContain("Existing Company");
    expect(JSON.stringify(rows)).toContain("logo_key");
    writeFileSync(
      resolve(migrationDirectory, "0004_invalid.sql"),
      "ALTER TABLE missing_table ADD COLUMN invalid TEXT;",
    );
    cf(["d1", "migrations", "apply", ...migrationArgs], false);
    expect(
      JSON.parse(cf(["d1", "migrations", "list", ...migrationArgs])),
    ).toEqual([{ Name: "0004_invalid.sql" }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
