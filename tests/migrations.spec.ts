import { test, expect } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("company-logo migration preserves existing companies and records", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of ["0001_initial.sql", "0002_invoice_numbers.sql"])
      db.exec(
        readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
      );
    db.exec(
      "INSERT INTO companies (id,name,created_at) VALUES ('legacy','Legacy Studio','2026-10-01'); INSERT INTO entries (id,company_id,kind,title,date,data,created_at,updated_at) VALUES ('note','legacy','note','Preserved note','2026-10-01','{}','2026-10-01','2026-10-01');",
    );
    db.exec(
      readFileSync(
        new URL("../migrations/0003_company_logos.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(
      db.prepare("SELECT name,logo_key FROM companies WHERE id='legacy'").get(),
    ).toEqual({ name: "Legacy Studio", logo_key: "" });
    expect(
      db.prepare("SELECT title FROM entries WHERE id='note'").get(),
    ).toEqual({ title: "Preserved note" });
    db.exec(
      "UPDATE companies SET logo_key='legacy/logos/example' WHERE id='legacy'",
    );
    expect(
      db.prepare("SELECT logo_key FROM companies WHERE id='legacy'").get()
        ?.logo_key,
    ).toBe("legacy/logos/example");
  } finally {
    db.close();
  }
});
