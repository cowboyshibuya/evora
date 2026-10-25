import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { Kind, Role } from "../lib/types";

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" }).notNull();
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).default(false),
});
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at"),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});
export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  logoKey: text("logo_key").notNull().default(""),
  name: text("name").notNull(),
  industry: text("industry").notNull().default(""),
  currency: text("currency").notNull().default("EUR"),
  country: text("country").notNull().default("Belgium"),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  fiscalMonth: integer("fiscal_month").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull().default("member"),
  },
  (t) => [
    uniqueIndex("membership_unique").on(t.companyId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);
export const entries = sqliteTable(
  "entries",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kind: text("kind").$type<Kind>().notNull(),
    title: text("title").notNull(),
    date: text("date").notNull(),
    amount: integer("amount").notNull().default(0),
    category: text("category").notNull().default("General"),
    status: text("status").notNull().default(""),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("entries_company_kind_date_idx").on(t.companyId, t.kind, t.date),
    uniqueIndex("entries_sales_invoice_number_unique")
      .on(t.companyId, sql`json_extract(${t.data}, '$.number')`)
      .where(
        sql`${t.kind} = 'invoice' AND COALESCE(json_extract(${t.data}, '$.direction'), 'receivable') = 'receivable'`,
      ),
  ],
);
export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").$type<Role>().notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
});
