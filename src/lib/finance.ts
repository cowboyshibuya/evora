import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Entry } from "./types";

export function summarize(records: Entry[], from = "", to = "") {
  const transactions = records.filter(
    (e) =>
      e.kind === "transaction" &&
      (!from || e.date >= from) &&
      (!to || e.date <= to),
  );
  const income = transactions
    .filter((e) => e.amount > 0)
    .reduce((s, e) => s + e.amount, 0);
  const expenses = -transactions
    .filter((e) => e.amount < 0)
    .reduce((s, e) => s + e.amount, 0);
  return {
    income,
    expenses,
    net: income - expenses,
    count: transactions.length,
  };
}
export function monthlySeries(records: Entry[], months = 6) {
  const now = new Date();
  return eachMonthOfInterval({
    start: startOfMonth(addMonths(now, -months + 1)),
    end: startOfMonth(now),
  }).map((date) => {
    const summary = summarize(
      records,
      format(date, "yyyy-MM-dd"),
      format(endOfMonth(date), "yyyy-MM-dd"),
    );
    return {
      month: format(date, "MMM"),
      income: summary.income / 100,
      expenses: summary.expenses / 100,
      net: summary.net / 100,
    };
  });
}
export function categoryTotals(records: Entry[], from = "", to = "") {
  const grouped: Record<string, number> = {};
  for (const entry of records)
    if (
      entry.kind === "transaction" &&
      entry.amount < 0 &&
      (!from || entry.date >= from) &&
      (!to || entry.date <= to)
    )
      grouped[entry.category] = (grouped[entry.category] || 0) - entry.amount;
  return Object.entries(grouped)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function priorPeriod(from: string, to: string, label: string) {
  if (!from || !to) return { from: "", to: "" };
  const start = parseISO(from),
    end = parseISO(to);
  const months =
    label === "This year"
      ? 12
      : label === "This quarter"
        ? 3
        : ["This month", "Last month"].includes(label)
          ? 1
          : 0;
  return months
    ? {
        from: format(addMonths(start, -months), "yyyy-MM-dd"),
        to: format(endOfMonth(addMonths(end, -months)), "yyyy-MM-dd"),
      }
    : {
        from: format(
          addDays(start, -differenceInCalendarDays(end, start) - 1),
          "yyyy-MM-dd",
        ),
        to: format(addDays(start, -1), "yyyy-MM-dd"),
      };
}
