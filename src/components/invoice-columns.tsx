import { invoiceStatus } from "@/lib/invoices";
import type { Entry } from "@/lib/types";
import { money, shortDate } from "@/lib/utils";
import { Status } from "./common";
import type { DataColumn } from "./ui/data-table";

export function invoiceFinancialColumns(
  currency?: string,
): DataColumn<Entry>[] {
  return [
    {
      id: "due",
      header: "Due date",
      cell: (entry) => shortDate(entry.date, "dd MMM yyyy"),
    },
    {
      id: "status",
      header: "Status",
      cell: (entry) => <Status value={invoiceStatus(entry)} />,
    },
    {
      id: "amount",
      header: "Amount",
      cell: (entry) => money(entry.amount, currency),
      align: "right",
      cellClassName: "amount",
    },
  ];
}
