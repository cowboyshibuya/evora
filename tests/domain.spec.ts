import { test, expect } from "@playwright/test";
import {
  calculateInvoiceTotals,
  invoiceLineAmount,
  invoiceStatus,
  isOutstandingInvoice,
  recordedInvoiceTotals,
} from "../src/lib/invoices";
import { canEditRecords, canManageCompany } from "../src/lib/permissions";
import type { Entry } from "../src/lib/types";

const invoice: Entry = {
  id: "invoice-1",
  companyId: "company-1",
  kind: "invoice",
  title: "Design services",
  date: "2026-10-18",
  amount: 543,
  category: "Services",
  status: "sent",
  data: {
    taxRate: 21,
    lines: [
      { description: "Consulting", quantity: 1.5, unitPrice: 101 },
      { description: "Support", quantity: 3, unitPrice: 99 },
    ],
  },
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

test("shared invoice calculations round each line before calculating VAT", () => {
  expect(
    invoiceLineAmount({
      description: "Fractional service",
      quantity: 1.5,
      unitPrice: 101,
    }),
  ).toBe(152);
  expect(
    calculateInvoiceTotals(
      [
        { description: "Consulting", quantity: 1.5, unitPrice: 101 },
        { description: "Support", quantity: 3, unitPrice: 99 },
      ],
      21,
    ),
  ).toEqual({ subtotal: 449, tax: 94, total: 543 });
  expect(
    calculateInvoiceTotals(
      [{ description: "Exempt service", quantity: 2, unitPrice: 15000 }],
      0,
    ),
  ).toEqual({ subtotal: 30000, tax: 0, total: 30000 });
});

test("issued invoice displays and exports preserve the recorded total", () => {
  expect(recordedInvoiceTotals(invoice)).toEqual({
    subtotal: 449,
    tax: 94,
    total: 543,
  });
  expect(recordedInvoiceTotals({ ...invoice, amount: 544 })).toEqual({
    subtotal: 449,
    tax: 95,
    total: 544,
  });
});

test("invoice due-date rules are shared by lists, notifications and details", () => {
  expect(invoiceStatus(invoice, "2026-10-19")).toBe("overdue");
  expect(invoiceStatus({ ...invoice, date: "2026-10-19" }, "2026-10-19")).toBe(
    "sent",
  );
  expect(invoiceStatus({ ...invoice, status: "paid" }, "2026-10-19")).toBe(
    "paid",
  );
  expect(isOutstandingInvoice(invoice)).toBe(true);
  expect(isOutstandingInvoice({ ...invoice, status: "overdue" })).toBe(true);
  expect(isOutstandingInvoice({ ...invoice, status: "draft" })).toBe(false);
  expect(isOutstandingInvoice({ ...invoice, status: "paid" })).toBe(false);
  expect(isOutstandingInvoice({ ...invoice, kind: "transaction" })).toBe(false);
});

test("browser and API permissions use the same role matrix", () => {
  for (const [role, edit, manage] of [
    ["owner", true, true],
    ["admin", true, true],
    ["member", true, false],
    ["viewer", false, false],
    [undefined, false, false],
  ] as const) {
    expect(canEditRecords(role), `${role}: edit records`).toBe(edit);
    expect(canManageCompany(role), `${role}: manage company`).toBe(manage);
  }
});
