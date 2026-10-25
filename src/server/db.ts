import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import migration from "../../migrations/0001_initial.sql?raw";
import invoiceNumbers from "../../migrations/0002_invoice_numbers.sql?raw";
import companyLogos from "../../migrations/0003_company_logos.sql?raw";

export function database() {
  return drizzle(env.DB, { schema });
}
export async function initializeLocalDatabase() {
  if (!import.meta.env.DEV) return;
  const markerExists = () =>
    env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_evora_local_migrations'",
    ).first();
  const version = async () =>
    (
      await env.DB.prepare(
        "SELECT MAX(version) AS version FROM _evora_local_migrations",
      ).first<{ version: number }>()
    )?.version || 0;
  const current = (await markerExists()) ? await version() : 0;
  const migrations = [migration, invoiceNumbers, companyLogos];
  if (current >= migrations.length) return;
  const sql = [
    "CREATE TABLE IF NOT EXISTS _evora_local_migrations (version INTEGER PRIMARY KEY)",
    ...migrations.slice(current),
    `INSERT OR IGNORE INTO _evora_local_migrations VALUES (${migrations.length})`,
  ].join(";");
  try {
    await env.DB.batch(
      sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => env.DB.prepare(s)),
    );
  } catch (error) {
    // Two local requests may race at startup. Another successful atomic batch
    // means the schema is already current; other failures must remain visible.
    if ((await markerExists()) && (await version()) >= migrations.length)
      return;
    throw error;
  }
}
