import type { Entry, EntryInput } from "./types";
import { TRANSACTION_CATEGORIES, PAYMENT_METHODS } from "./transaction-options";

export const profileName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
export function companyProfiles(entries: Entry[], companyId: string) {
  return entries.filter(
    (entry) => entry.companyId === companyId && entry.kind === "contact",
  );
}
export function profileDefaults(profile: Entry) {
  const category = String(profile.data.transactionCategory || "");
  const method = String(profile.data.method || "");
  return {
    ...(TRANSACTION_CATEGORIES.some((option) => option === category)
      ? { category }
      : {}),
    ...(PAYMENT_METHODS.some((option) => option === method) ? { method } : {}),
  };
}
export function profileFromRecord(input: EntryInput): EntryInput {
  const expense =
    input.kind === "invoice"
      ? input.data.direction === "payable"
      : input.amount < 0;
  return {
    kind: "contact",
    title: String(
      input.kind === "invoice"
        ? input.data.client || ""
        : input.data.counterparty || "",
    ).trim(),
    date: input.date,
    amount: 0,
    status: "active",
    category: expense ? "Supplier" : "Client",
    data: {
      email:
        input.kind === "invoice" ? String(input.data.clientEmail || "") : "",
      transactionCategory: TRANSACTION_CATEGORIES.some(
        (option) => option === input.category,
      )
        ? input.category
        : expense
          ? "Other"
          : "Client work",
      method: input.data.method || "Bank transfer",
    },
  };
}
