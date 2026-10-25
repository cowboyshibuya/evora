import { invoiceFinancialColumns } from "./invoice-columns";
import { CashFlowChart } from "./cash-flow-chart";
import { DataTable } from "./ui/data-table";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Plus,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { useWorkspace } from "@/lib/workspace-context";
import {
  categoryTotals,
  monthlySeries,
  summarize,
  priorPeriod,
} from "@/lib/finance";
import { cn, money, shortDate, today } from "@/lib/utils";
import {
  Avatar,
  CheckButton,
  Empty,
  FileIcon,
  PageHeader,
  PanelHeading,
} from "./common";
import { invoiceStatus, isOutstandingInvoice } from "@/lib/invoices";
import { Button } from "./ui/button";
import { PeriodPicker, usePeriod } from "./period-picker";
import { Select } from "./ui/select";

export function Overview() {
  const { workspace, createEntry, openEntry, saveEntry, exportData, canEdit } =
      useWorkspace(),
    { entries, company, user } = workspace,
    { period, setPeriod } = usePeriod(),
    [months, setMonths] = useState("6");
  const current = summarize(entries, period.from, period.to),
    comparison = priorPeriod(period.from, period.to, period.label),
    previous = summarize(entries, comparison.from, comparison.to);
  const outstanding = entries.filter(
      (e) => isOutstandingInvoice(e) && e.data.direction !== "payable",
    ),
    overdue = outstanding.filter((e) => invoiceStatus(e) === "overdue"),
    unpaid = outstanding.reduce((s, e) => s + e.amount, 0);
  const events = entries
      .filter((e) => e.kind === "event" && e.status === "pending")
      .sort((a, b) => a.date.localeCompare(b.date)),
    docs = entries.filter((e) => e.kind === "document").slice(0, 3);
  const expenses = categoryTotals(entries, period.from, period.to),
    colors = [
      "var(--primary)",
      "var(--chart-2)",
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
    ];
  const delta = (value: number, before: number) =>
    before ? Math.round(((value - before) / Math.abs(before)) * 100) : 0;
  const hour = new Date().getHours(),
    greeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";
  const sparkData = monthlySeries(entries, 6);
  const spark = (key: "income" | "expenses" | "net") => {
    const values = sparkData.map((d) => d[key]),
      min = Math.min(...values),
      max = Math.max(...values);
    return values
      .map(
        (v, i) =>
          `${i * 16},${max === min ? 17 : 30 - ((v - min) / (max - min)) * 27}`,
      )
      .join(" ");
  };
  const stats = [
    {
      label: "Total income",
      amount: current.income,
      icon: ArrowDownLeft,
      delta: delta(current.income, previous.income),
      note: period.label === "All time" ? "all time" : "vs. previous period",
      className: "income",
      spark: spark("income"),
    },
    {
      label: "Total expenses",
      amount: current.expenses,
      icon: ArrowUpRight,
      delta: delta(current.expenses, previous.expenses),
      note: period.label === "All time" ? "all time" : "vs. previous period",
      className: "expense",
      spark: spark("expenses"),
    },
    {
      label: "Net cash flow",
      amount: current.net,
      icon: TrendingUp,
      delta: delta(current.net, previous.net),
      note: period.label === "All time" ? "all time" : "vs. previous period",
      className: "income",
      spark: spark("net"),
    },
    {
      label: "Outstanding invoices",
      amount: unpaid,
      icon: Receipt,
      delta: null,
      note: `${outstanding.length} awaiting payment`,
      className: "neutral",
      spark: "",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, dd MMMM yyyy")}
        title={`${greeting}, ${user.name.split(" ")[0]}.`}
        description="A little clarity. A lot less admin. Here’s your company at a glance."
        actions={
          <>
            <PeriodPicker period={period} onChange={setPeriod} />
            <Button
              variant="outline"
              onClick={() => exportData("all", period.from, period.to)}
            >
              <Download size={15} />
              Export
            </Button>
          </>
        }
      />
      <div className="metrics-grid">
        {stats.map((stat) => (
          <section className="metric-card" key={stat.label}>
            <div className="metric-label">
              <span>{stat.label}</span>
              <stat.icon size={17} />
            </div>
            <div className="metric-value">
              {money(stat.amount, company?.currency)}
            </div>
            <div className="metric-bottom">
              <span
                className={cn(
                  "metric-change",
                  stat.delta !== null && stat.className,
                )}
              >
                {stat.delta !== null ? (
                  <>
                    {stat.delta < 0 ? (
                      <ArrowDownRight size={12} />
                    ) : (
                      <ArrowUpRight size={12} />
                    )}
                    {Math.abs(stat.delta)}%
                  </>
                ) : (
                  <span className="tiny-dot" />
                )}
              </span>
              <span>{stat.note}</span>
              {stat.spark && (
                <svg
                  className={cn("sparkline", stat.className)}
                  viewBox="0 0 80 34"
                  aria-hidden="true"
                >
                  <polyline
                    points={stat.spark}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          </section>
        ))}
      </div>
      <div className="overview-top-grid">
        <section className="panel cashflow-panel">
          <PanelHeading
            title="Cash flow"
            description="The ins and outs of your business."
            action={
              <Select
                className="compact-select"
                label="Cash flow chart period"
                value={months}
                onValueChange={setMonths}
                options={[
                  { value: "6", label: "Last 6 months" },
                  { value: "3", label: "Last 3 months" },
                  { value: "12", label: "Last 12 months" },
                ]}
              />
            }
          />
          <div className="chart-meta">
            <span>
              <i className="legend-dot green" />
              Income
            </span>
            <span>
              <i className="legend-dot gray" />
              Expenses
            </span>
            <span className="chart-currency">{company?.currency}</span>
          </div>
          <CashFlowChart
            entries={entries}
            months={Number(months)}
            currency={company?.currency}
          />
          <div className="chart-footer">
            <span>
              <span className="live-dot" />
              Your finances, in perspective
            </span>
            <Link to="/$page" params={{ page: "reports" }}>
              View reports
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>
        <section className="panel upcoming-panel">
          <PanelHeading
            title="Coming up"
            description="A little planning goes a long way."
            action={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add reminder"
                disabled={!canEdit}
                onClick={() => createEntry("event")}
              >
                <Plus size={18} />
              </Button>
            }
          />
          <div className="upcoming-list">
            {events.slice(0, 3).map((event) => (
              <div className="upcoming-item" key={event.id}>
                <div
                  className={cn("date-tile", event.date === today() && "today")}
                >
                  <span>{shortDate(event.date, "MMM")}</span>
                  <strong>{shortDate(event.date, "dd")}</strong>
                </div>
                <button
                  className="upcoming-description"
                  onClick={() => openEntry(event)}
                >
                  <strong>{event.title}</strong>
                  <span>
                    {event.category} <i>·</i>{" "}
                    {String(event.data.time || "All day")}
                  </span>
                </button>
                <CheckButton
                  disabled={!canEdit}
                  checked={false}
                  label={`Complete ${event.title}`}
                  onClick={() =>
                    saveEntry({ ...event, status: "done" }, event.id).catch(
                      (e) => toast.error(e.message, { duration: Infinity }),
                    )
                  }
                />
              </div>
            ))}
            {!events.length && (
              <Empty
                title="A clear calendar"
                description="Add a reminder for your next important date."
              />
            )}
          </div>
          <Link
            className="panel-bottom-link"
            to="/$page"
            params={{ page: "calendar" }}
          >
            Open calendar
            <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="overview-middle-grid">
        <section className="panel invoices-panel">
          <PanelHeading
            title="Invoices to keep an eye on"
            description={
              overdue.length
                ? `${overdue.length} overdue. A friendly follow-up could help.`
                : "Stay on top of what’s coming in."
            }
            action={
              <Link
                className="text-link"
                to="/$page"
                params={{ page: "invoices" }}
              >
                View all
                <ArrowUpRight size={14} />
              </Link>
            }
          />
          <>
            <DataTable
              variant="dashboard"
              rows={outstanding
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 4)}
              rowKey={(invoice) => invoice.id}
              columns={[
                {
                  id: "invoice",
                  header: "Client / Invoice",
                  cell: (invoice) => (
                    <button
                      className="client-cell"
                      onClick={() => openEntry(invoice)}
                    >
                      <Avatar name={String(invoice.data.client)} tone="party" />
                      <span>
                        <strong>{String(invoice.data.client)}</strong>
                        <small>{String(invoice.data.number)}</small>
                      </span>
                    </button>
                  ),
                },
                ...invoiceFinancialColumns(company?.currency),
                {
                  id: "actions",
                  header: null,
                  cell: (invoice) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Open invoice ${invoice.data.number}`}
                      onClick={() => openEntry(invoice)}
                    >
                      <ChevronRight size={15} />
                    </Button>
                  ),
                },
              ]}
            />
            {!outstanding.length && (
              <Empty
                title="All caught up"
                description="Your next invoice will appear here."
              />
            )}
          </>
        </section>
        <section className="panel expense-panel">
          <PanelHeading
            title="Where it goes"
            description="Your expenses, made a little clearer."
          />
          <div className="expense-total">
            {money(current.expenses, company?.currency)}
            <span>{period.label.toLowerCase()}</span>
          </div>
          <div className="expense-bar" aria-hidden="true">
            {expenses.slice(0, 5).map((e, i) => (
              <span
                key={e.name}
                style={{
                  width: `${(e.amount / current.expenses) * 100}%`,
                  background: colors[i],
                }}
              />
            ))}
          </div>
          <div className="expense-breakdown">
            {expenses.slice(0, 4).map((e, i) => (
              <div key={e.name}>
                <span>
                  <i style={{ background: colors[i] }} />
                  {e.name}
                </span>
                <strong>{money(e.amount, company?.currency)}</strong>
              </div>
            ))}
            {!expenses.length && (
              <p className="muted">No expenses in this period.</p>
            )}
          </div>
        </section>
      </div>
      <section className="recent-documents">
        <div className="section-heading">
          <h2>Recently added documents</h2>
          <Link
            className="text-link"
            to="/$page"
            params={{ page: "documents" }}
          >
            All documents
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="recent-document-grid">
          {docs.map((doc) => (
            <button
              className="recent-document"
              key={doc.id}
              onClick={() => openEntry(doc)}
            >
              <FileIcon name={doc.title} />
              <span>
                <strong>{doc.title}</strong>
                <small>
                  {doc.category} <i>·</i> {shortDate(doc.date, "dd MMM")}
                </small>
              </span>
              <Download size={15} />
            </button>
          ))}
          {!docs.length && (
            <div className="muted no-documents">
              Your company’s documents will find a home here.
            </div>
          )}
        </div>
      </section>
      <div className="overview-footnote">
        <span>
          <Check size={13} />
          Everything in its place. A little peace of mind.
        </span>
        <span>
          Made for the way you work.<span className="mini-brand">evora.</span>
        </span>
      </div>
    </>
  );
}
