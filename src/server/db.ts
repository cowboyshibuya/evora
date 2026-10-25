import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import migration from "../../migrations/0001_initial.sql?raw";
import invoiceNumbers from "../../migrations/0002_invoice_numbers.sql?raw";

export function database() {
  return drizzle(env.DB, { schema });
}
export async function initializeLocalDatabase() {
  if (import.meta.env.DEV) {
    const exists = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_evora_local_migrations'",
    ).first();
    if (!exists) {
      const sql =
        migration +
        invoiceNumbers +
        "CREATE TABLE IF NOT EXISTS _evora_local_migrations (version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO _evora_local_migrations VALUES (2);";
      await env.DB.batch(
        sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => env.DB.prepare(s)),
      );
    }
  }
}
