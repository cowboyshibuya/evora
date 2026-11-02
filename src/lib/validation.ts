import { TRANSACTION_CATEGORIES, PAYMENT_METHODS } from "./transaction-options";
import { z } from "zod";
import { CURRENCIES } from "./company-options";
export const companyInput = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().max(100).default(""),
  currency: z.enum(CURRENCIES).default("EUR"),
  country: z.string().max(80).default("Belgium"),
  email: z.union([z.email(), z.literal("")]).default(""),
  address: z.string().max(500).default(""),
  taxId: z.string().max(80).default(""),
  fiscalMonth: z.number().int().min(1).max(12).default(1),
});
const profileFields = z
  .object({
    profileId: z.string().min(1).max(500).optional(),
    saveProfile: z.boolean().optional(),
  })
  .passthrough();
const contactFields = z
  .object({
    email: z.union([z.email(), z.literal("")]).optional(),
    transactionCategory: z.enum(TRANSACTION_CATEGORIES).optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    taxId: z.string().max(80).optional(),
  })
  .passthrough();

export const entryInput = z
  .object({
    kind: z.enum([
      "transaction",
      "invoice",
      "event",
      "note",
      "contact",
      "document",
    ]),
    title: z.string().trim().min(1, "Enter a title.").max(240),
    date: z.iso.date(),
    amount: z.number().int().min(-999999999999).max(999999999999).default(0),
    category: z.string().max(100).default("General"),
    status: z.string().max(40).default(""),
    data: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    const fields = v.kind === "contact" ? contactFields : profileFields;
    const parsed = fields.safeParse(v.data);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: ["data", ...issue.path],
        });

    if (v.kind === "transaction" && v.amount === 0)
      ctx.addIssue({
        code: "custom",
        message: "Enter an amount greater than zero.",
        path: ["amount"],
      });
    if (
      v.kind === "event" &&
      v.data.recurrence &&
      !["none", "monthly", "yearly"].includes(String(v.data.recurrence))
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose a supported repeat interval.",
        path: ["data"],
      });
    if (
      v.kind === "invoice" &&
      !["draft", "sent", "paid", "overdue"].includes(v.status)
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid invoice status.",
        path: ["status"],
      });
    if (v.kind === "event" && !["pending", "done"].includes(v.status))
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid event status.",
        path: ["status"],
      });
    if (v.kind === "invoice" && v.amount < 0)
      ctx.addIssue({
        code: "custom",
        message: "Invoice amounts must be positive.",
        path: ["amount"],
      });
    if (
      v.kind === "invoice" &&
      (!v.data.client ||
        !v.data.number ||
        !Array.isArray(v.data.lines) ||
        !v.data.lines.length)
    )
      ctx.addIssue({
        code: "custom",
        message: "Add a client, invoice number and at least one line item.",
        path: ["data"],
      });
  });
