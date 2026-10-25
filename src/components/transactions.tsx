import { SummaryStrip } from "./summary-strip";
import { SearchInput } from "./ui/search-input";
import { DataTable, TableToolbar, TableFooter } from "./ui/data-table";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Plus,
  Wallet,
  Upload,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { money, shortDate } from "@/lib/utils";
import { summarize } from "@/lib/finance";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Tabs } from "./ui/tabs";
import { Empty, PageHeader, RecordMenu, TransactionIcon } from "./common";
import { PeriodPicker, usePeriod } from "./period-picker";
import { ImportDialog } from "./import-dialog";

export function Transactions() {
  const {
      workspace,
      createEntry,
      openEntry,
      deleteEntry,
      exportData,
      canEdit,
    } = useWorkspace(),
    { period, setPeriod } = usePeriod();
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState("all"),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(1),
    [importing, setImporting] = useState(false);
  const transactions = workspace.entries.filter(
      (e) => e.kind === "transaction",
    ),
    categories = [...new Set(transactions.map((e) => e.category))].sort(),
    summary = summarize(workspace.entries, period.from, period.to);
  const filtered = transactions
    .filter(
      (e) =>
        (!period.from || e.date >= period.from) &&
        (!period.to || e.date <= period.to) &&
        (tab === "all" || (tab === "income" ? e.amount > 0 : e.amount < 0)) &&
        (category === "all" || e.category === category) &&
        `${e.title} ${e.category} ${e.data.counterparty || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const pages = Math.max(1, Math.ceil(filtered.length / 12)),
    currentPage = Math.min(page, pages),
    visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  return (
    <>
      <PageHeader
        title="Every movement, accounted for."
        actions={
          <>
            <Button
              variant="outline"
              disabled={!canEdit}
              onClick={() => setImporting(true)}
            >
              <Upload size={15} />
              Import CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => exportData("transaction", period.from, period.to)}
            >
              <Download size={15} />
              Export
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() => createEntry("transaction")}
            >
              <Plus size={16} />
              Add transaction
            </Button>
          </>
        }
      />
      <SummaryStrip
        currency={workspace.company?.currency}
        items={[
          {
            label: "Money in",
            amount: summary.income,
            icon: ArrowDownLeft,
            tone: "income",
          },
          { label: "Money out", amount: summary.expenses, icon: ArrowUpRight },
          { label: "Net cash flow", amount: summary.net, icon: Wallet },
        ]}
      />
      <section className="panel full-table-panel">
        <div className="table-top">
          <Tabs
            label="Transaction direction"
            value={tab}
            onValueChange={setTab}
            items={[
              {
                value: "all",
                label: "All transactions",
                count: transactions.length,
              },
              { value: "income", label: "Income" },
              { value: "expense", label: "Expenses" },
            ]}
          />
        </div>
        <TableToolbar>
          <SearchInput
            label="Search transactions"
            value={query}
            onValueChange={setQuery}
            placeholder="Search transactions…"
          />
          <div className="filter-controls">
            <Select
              value={category}
              onValueChange={setCategory}
              label="Filter by category"
              options={[
                { value: "all", label: "All categories" },
                ...categories,
              ]}
            />
            <PeriodPicker period={period} onChange={setPeriod} />
          </div>
        </TableToolbar>
        <DataTable
          id="filter-results"
          role="tabpanel"
          aria-label="Transactions"
          rows={visible}
          rowKey={(entry) => entry.id}
          columns={[
            {
              id: "description",
              header: "Description",
              cell: (entry) => (
                <button
                  className="client-cell"
                  onClick={() => openEntry(entry)}
                >
                  <TransactionIcon entry={entry} />
                  <span>
                    <strong>{entry.title}</strong>
                    <small>
                      {String(entry.data.counterparty || "Manual transaction")}
                    </small>
                  </span>
                </button>
              ),
            },
            {
              id: "category",
              header: "Category",
              cell: (entry) => (
                <span className="category-badge">{entry.category}</span>
              ),
            },
            {
              id: "date",
              header: "Date",
              cell: (entry) => shortDate(entry.date),
            },
            {
              id: "method",
              header: "Method",
              cell: (entry) => String(entry.data.method || "—"),
              cellClassName: "muted",
            },
            {
              id: "amount",
              header: "Amount",
              cell: (entry) => (
                <>
                  {entry.amount > 0 ? "+" : "−"}
                  {money(Math.abs(entry.amount), workspace.company?.currency)}
                </>
              ),
              align: "right",
              cellClassName: (entry) =>
                `right amount ${entry.amount > 0 ? "income" : ""}`,
            },
            {
              id: "actions",
              header: null,
              cell: (entry) =>
                canEdit &&
                !entry.data.invoiceId && (
                  <RecordMenu
                    onEdit={() => openEntry(entry)}
                    onDelete={() => deleteEntry(entry)}
                  />
                ),
            },
          ]}
        />
        {!filtered.length && (
          <Empty
            title={query ? `No transactions for “${query}”` : "A clean start"}
            description="Add a transaction or choose a different period."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setTab("all");
                  setCategory("all");
                  setPeriod({ label: "All time", from: "", to: "" });
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
        <TableFooter
          actions={
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <span>
                {currentPage} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          }
        >
          {filtered.length
            ? `${(currentPage - 1) * 12 + 1}–${Math.min(currentPage * 12, filtered.length)}`
            : "0"}{" "}
          of {filtered.length} transactions
        </TableFooter>
      </section>
      <p className="page-note">
        Amounts are recorded in {workspace.company?.currency}. Invoice payments
        are added to your income automatically.
      </p>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </>
  );
}
