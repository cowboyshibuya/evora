import { CashFlowChart } from "./cash-flow-chart";
import { recordedInvoiceTotals } from "@/lib/invoices";
import { useState } from "react";
import { Download, FileSpreadsheet, TrendingUp } from "lucide-react";
import { categoryTotals, summarize } from "@/lib/finance";
import { money } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "./ui/button";
import { Tabs } from "./ui/tabs";
import { PageHeader, PanelHeading } from "./common";
import { PeriodPicker, usePeriod } from "./period-picker";

export function Reports() {
  const { workspace, exportData } = useWorkspace(),
    { period, setPeriod } = usePeriod(),
    [tab, setTab] = useState("profit");
  const summary = summarize(workspace.entries, period.from, period.to),
    categories = categoryTotals(workspace.entries, period.from, period.to),
    currency = workspace.company?.currency;
  const invoices = workspace.entries.filter(
    (e) =>
      e.kind === "invoice" &&
      e.data.direction !== "payable" &&
      e.status !== "draft" &&
      (!period.from || String(e.data.issuedDate || e.date) >= period.from) &&
      (!period.to || String(e.data.issuedDate || e.date) <= period.to),
  );
  const vat = (paid: boolean) =>
    invoices
      .filter((e) => (e.status === "paid") === paid)
      .reduce((s, e) => s + recordedInvoiceTotals(e).tax, 0);
  return (
    <>
      <PageHeader
        title="See the bigger picture."
        actions={
          <>
            <PeriodPicker period={period} onChange={setPeriod} />
            <Button
              onClick={() =>
                exportData(
                  tab === "vat" ? "invoice" : "transaction",
                  period.from,
                  period.to,
                )
              }
            >
              <Download size={15} />
              Export report
            </Button>
          </>
        }
      />
      <Tabs
        label="Report type"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "profit", label: "Income & expenses" },
          { value: "cash", label: "Cash flow" },
          { value: "vat", label: "Invoice VAT summary" },
        ]}
      />
      <div
        id="filter-results"
        role="tabpanel"
        aria-label="Reports"
        className="reports-grid"
      >
        <section className="panel report-statement">
          <PanelHeading
            title={
              tab === "vat"
                ? "Invoice VAT summary"
                : tab === "cash"
                  ? "Cash flow statement"
                  : "Income & expense statement"
            }
          />
          <div className="statement-body">
            {tab === "vat" ? (
              <>
                <div className="statement-section-title">Sales invoices</div>
                <div className="statement-row">
                  <span>Invoices issued</span>
                  <strong>{invoices.length}</strong>
                </div>
                <div className="statement-row">
                  <span>Total including VAT</span>
                  <strong>
                    {money(
                      invoices.reduce((s, e) => s + e.amount, 0),
                      currency,
                    )}
                  </strong>
                </div>
                <div className="statement-row">
                  <span>VAT on paid invoices</span>
                  <strong>{money(vat(true), currency)}</strong>
                </div>
                <div className="statement-row">
                  <span>VAT on unpaid invoices</span>
                  <strong>{money(vat(false), currency)}</strong>
                </div>
                <div className="statement-total">
                  <span>Total sales VAT</span>
                  <strong>{money(vat(true) + vat(false), currency)}</strong>
                </div>
                <p className="report-caveat">
                  This summary covers sales invoice VAT. Purchase VAT and filing
                  adjustments are not included. Use your original records with
                  your accountant when preparing a tax return.
                </p>
              </>
            ) : (
              <>
                <div className="statement-section-title">Income</div>
                <div className="statement-row">
                  <span>Received payments & other income</span>
                  <strong className="income">
                    {money(summary.income, currency)}
                  </strong>
                </div>
                <div className="statement-section-title">Expenses</div>
                {categories.map((c) => (
                  <div className="statement-row" key={c.name}>
                    <span>{c.name}</span>
                    <strong>{money(c.amount, currency)}</strong>
                  </div>
                ))}
                {!categories.length && (
                  <p className="muted">No expenses in this period.</p>
                )}
                <div className="statement-subtotal">
                  <span>Total expenses</span>
                  <strong>{money(summary.expenses, currency)}</strong>
                </div>
                <div className="statement-total">
                  <span>
                    {tab === "cash" ? "Net cash flow" : "Net cash surplus"}
                  </span>
                  <strong className={summary.net >= 0 ? "income" : "danger"}>
                    {money(summary.net, currency)}
                  </strong>
                </div>
                <p className="report-caveat">
                  Cash basis · amounts include VAT where recorded. Unpaid
                  invoices and opening balances are excluded. This is a
                  bookkeeping summary, not a statutory financial statement.
                </p>
              </>
            )}
          </div>
        </section>
        <section className="panel report-insights">
          <PanelHeading title="A year in perspective" />
          <CashFlowChart
            entries={workspace.entries}
            months={12}
            currency={currency}
            variant="report"
          />
          <div className="report-highlight">
            <TrendingUp size={19} />
            <div>
              <strong>
                {summary.income
                  ? Math.round((summary.net / summary.income) * 100)
                  : 0}
                % cash margin
              </strong>
              <p>What remains after your recorded expenses.</p>
            </div>
          </div>
          <div className="export-callout">
            <FileSpreadsheet size={23} />
            <h3>Ready for your accountant.</h3>
            <p>
              Export your records as an Excel workbook with a separate tab for
              each type of record.
            </p>
            <Button
              variant="outline"
              onClick={() => exportData("all", period.from, period.to)}
            >
              <Download size={14} />
              Prepare an export
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
