import type { Entry, InvoiceLine } from "./types";
import { today } from "./utils";

export function invoiceLineAmount(line: InvoiceLine) {
  return Math.round(line.quantity * line.unitPrice);
}

export function calculateInvoiceTotals(
  lines: readonly InvoiceLine[],
  taxRate: number,
) {
  const subtotal = lines.reduce(
    (sum, line) => sum + invoiceLineAmount(line),
    0,
  );
  const tax = Math.round((subtotal * taxRate) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

/** Use the recorded total when displaying an issued invoice or historical data. */
export function recordedInvoiceTotals(entry: Entry) {
  const { subtotal } = calculateInvoiceTotals(
    (entry.data.lines as InvoiceLine[]) || [],
    Number(entry.data.taxRate || 0),
  );
  return { subtotal, tax: entry.amount - subtotal, total: entry.amount };
}

export function invoiceStatus(entry: Entry, date = today()) {
  return entry.status === "sent" && entry.date < date
    ? "overdue"
    : entry.status;
}

export function isOutstandingInvoice(entry: Entry) {
  return entry.kind === "invoice" && ["sent", "overdue"].includes(entry.status);
}
