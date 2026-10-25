import { invoiceFinancialColumns } from "./invoice-columns";
import { SummaryStrip } from "./summary-strip";
import { SearchInput } from "./ui/search-input";
import { DataTable, TableToolbar, TableFooter } from "./ui/data-table";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { shortDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Tabs } from "./ui/tabs";
import { Avatar, Empty, PageHeader, RecordMenu } from "./common";
import { invoiceStatus, isOutstandingInvoice } from "@/lib/invoices";

export function Invoices() {
  const {
      workspace,
      createEntry,
      openEntry,
      editEntry,
      deleteEntry,
      exportData,
      canEdit,
    } = useWorkspace(),
    [tab, setTab] = useState("all"),
    [query, setQuery] = useState(""),
    [direction, setDirection] = useState("receivable");
  const invoices = workspace.entries.filter(
      (e) =>
        e.kind === "invoice" &&
        (e.data.direction || "receivable") === direction,
    ),
    filtered = invoices
      .filter(
        (e) =>
          (tab === "all" || invoiceStatus(e) === tab) &&
          `${e.title} ${e.data.client} ${e.data.number}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  const total = (status: string) =>
    invoices
      .filter((e) =>
        status === "outstanding"
          ? isOutstandingInvoice(e)
          : invoiceStatus(e) === status,
      )
      .reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <PageHeader
        title="Good work deserves to be paid."
        description="Create invoices, track what’s due, and keep things moving."
        actions={
          <>
            <Button variant="outline" onClick={() => exportData("invoice")}>
              <Download size={15} />
              Export
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() =>
                createEntry("invoice", {
                  category:
                    direction === "payable"
                      ? "Professional services"
                      : "Services",
                  data: { direction },
                })
              }
            >
              <Plus size={16} />
              {direction === "payable" ? "Add supplier bill" : "Create invoice"}
            </Button>
          </>
        }
      />
      <SummaryStrip
        columns="four"
        currency={workspace.company?.currency}
        items={[
          {
            label: direction === "payable" ? "Total bills" : "Total invoiced",
            amount: invoices
              .filter((e) => e.status !== "draft")
              .reduce((sum, e) => sum + e.amount, 0),
          },
          { label: "Awaiting payment", amount: total("outstanding") },
          { label: "Overdue", amount: total("overdue"), tone: "danger" },
          {
            label: direction === "payable" ? "Paid to suppliers" : "Paid",
            amount: total("paid"),
            tone: "income",
          },
        ]}
      />
      <section className="panel full-table-panel">
        <div className="table-top">
          <Tabs
            value={tab}
            onValueChange={setTab}
            label="Invoice status"
            items={["all", "draft", "sent", "overdue", "paid"].map(
              (status) => ({
                value: status,
                label:
                  status === "all"
                    ? "All invoices"
                    : status === "sent"
                      ? "Awaiting payment"
                      : status[0].toUpperCase() + status.slice(1),
                count: invoices.filter(
                  (e) => status === "all" || invoiceStatus(e) === status,
                ).length,
              }),
            )}
          />
        </div>
        <TableToolbar>
          <SearchInput
            label="Search invoices"
            placeholder="Search by client or invoice number…"
            value={query}
            onValueChange={setQuery}
          />
          <Select
            label="Invoice direction"
            value={direction}
            onValueChange={setDirection}
            options={[
              { value: "receivable", label: "Sales invoices" },
              { value: "payable", label: "Supplier bills" },
            ]}
          />
        </TableToolbar>
        <DataTable
          id="filter-results"
          role="tabpanel"
          aria-label="Invoices"
          rows={filtered}
          rowKey={(entry) => entry.id}
          columns={[
            {
              id: "invoice",
              header: "Invoice",
              cell: (entry) => (
                <button
                  className="invoice-number"
                  onClick={() => openEntry(entry)}
                >
                  <strong>{String(entry.data.number)}</strong>
                  <small>{entry.title}</small>
                </button>
              ),
            },
            {
              id: "party",
              header: direction === "payable" ? "Supplier" : "Client",
              cell: (entry) => (
                <span className="client-inline">
                  <Avatar name={String(entry.data.client)} tone="party" />
                  {String(entry.data.client)}
                </span>
              ),
            },
            {
              id: "issued",
              header: "Issued",
              cell: (entry) =>
                shortDate(
                  String(entry.data.issuedDate || entry.date),
                  "dd MMM yyyy",
                ),
            },
            ...invoiceFinancialColumns(workspace.company?.currency),
            {
              id: "actions",
              header: null,
              cell: (entry) =>
                canEdit &&
                entry.status !== "paid" && (
                  <RecordMenu
                    onEdit={() => editEntry(entry)}
                    onDelete={() => deleteEntry(entry)}
                  />
                ),
            },
          ]}
        />
        {!filtered.length && (
          <Empty
            title={
              query
                ? `No invoices for “${query}”`
                : `No ${tab === "all" ? "" : tab + " "}invoices yet`
            }
            description="Your next client project starts with a clear invoice."
            action={
              <Button
                variant="outline"
                disabled={!canEdit}
                onClick={() => createEntry("invoice")}
              >
                <Plus size={15} />
                Create an invoice
              </Button>
            }
          />
        )}
        <TableFooter actions={<span>All amounts include VAT</span>}>
          {filtered.length} invoices
        </TableFooter>
      </section>
    </>
  );
}
