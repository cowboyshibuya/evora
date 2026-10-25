import { PanelHeading } from "./common";
import { useState } from "react";
import { toast } from "sonner";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Receipt,
} from "lucide-react";
import { cn, money, shortDate, today } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { CheckButton, Empty, PageHeader } from "./common";

export function Calendar() {
  const { workspace, createEntry, openEntry, saveEntry, exportData, canEdit } =
      useWorkspace(),
    [month, setMonth] = useState(startOfMonth(new Date())),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(""),
    [showDone, setShowDone] = useState(false);
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const events = workspace.entries.filter(
    (e) =>
      (e.kind === "event" ||
        (e.kind === "invoice" &&
          e.status !== "draft" &&
          e.status !== "paid")) &&
      (filter === "all" || e.kind === filter) &&
      (showDone || e.status !== "done"),
  );
  const visible = events
    .filter((e) =>
      selected
        ? e.date === selected
        : e.date.startsWith(format(month, "yyyy-MM")),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageHeader
        title="Room to plan ahead."
        description="Tax deadlines, invoice due dates, and the dates that matter to your company."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                exportData(
                  "all",
                  format(month, "yyyy-MM-dd"),
                  format(endOfMonth(month), "yyyy-MM-dd"),
                )
              }
            >
              <Download size={15} />
              Export calendar
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() =>
                createEntry("event", { date: selected || today() })
              }
            >
              <Plus size={16} />
              Add reminder
            </Button>
          </>
        }
      />
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-toolbar">
            <div>
              <h2>{format(month, "MMMM yyyy")}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => {
                  setMonth(addMonths(month, -1));
                  setSelected("");
                }}
              >
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => {
                  setMonth(addMonths(month, 1));
                  setSelected("");
                }}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonth(startOfMonth(new Date()));
                setSelected(today());
              }}
            >
              Today
            </Button>
          </div>
          <div className="calendar-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const date = format(day, "yyyy-MM-dd"),
                items = events.filter((e) => e.date === date);
              return (
                <div
                  className={cn(
                    "calendar-day",
                    !isSameMonth(day, month) && "outside",
                    date === selected && "selected",
                  )}
                  key={date}
                >
                  <button
                    aria-label={`Show ${format(day, "EEEE dd MMMM yyyy")}, ${items.length} events`}
                    className={cn("day-number", date === today() && "is-today")}
                    onClick={() => {
                      setSelected(selected === date ? "" : date);
                      if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
                    }}
                  >
                    {format(day, "d")}
                  </button>
                  <div className="day-events">
                    {items.slice(0, 2).map((item) => (
                      <button
                        key={item.id}
                        title={item.title}
                        className={cn(
                          "calendar-event",
                          item.kind === "invoice" ? "invoice-event" : "",
                          item.status === "done" && "done-event",
                        )}
                        onClick={() => openEntry(item)}
                      >
                        <span />
                        {item.kind === "invoice"
                          ? `${item.data.client} · invoice`
                          : item.title}
                      </button>
                    ))}
                    {items.length > 2 && (
                      <button
                        className="calendar-more"
                        onClick={() => setSelected(date)}
                      >
                        +{items.length - 2} more
                      </button>
                    )}
                  </div>
                  <span className="mobile-event-dots" aria-hidden="true">
                    {items.slice(0, 3).map((i) => (
                      <i key={i.id} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-dot green" />
              Reminders
            </span>
            <span>
              <i className="legend-dot amber" />
              Invoices due
            </span>
            <span>Choose a date to see its agenda</span>
          </div>
        </section>
        <section className="panel agenda-panel">
          <PanelHeading
            title={
              selected ? shortDate(selected, "dd MMMM") : "This month’s agenda"
            }
            description={`${visible.length} things on your calendar`}
            action={
              selected && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected("")}
                >
                  View month
                </Button>
              )
            }
          />
          <div className="agenda-filters">
            <Select
              label="Filter calendar events"
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: "all", label: "Everything" },
                { value: "event", label: "Reminders" },
                { value: "invoice", label: "Invoice due dates" },
              ]}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
              />
              Show completed
            </label>
          </div>
          <div className="agenda-list">
            {visible.map((event) => (
              <div className="agenda-item" key={event.id}>
                <div className="agenda-date">
                  {shortDate(event.date, "EEE, dd MMM")}
                  <span>
                    {event.kind === "invoice"
                      ? "Payment due"
                      : String(event.data.time || "All day")}
                  </span>
                </div>
                <div className="agenda-body">
                  <div className="agenda-title">
                    {event.kind === "event" ? (
                      <CheckButton
                        disabled={!canEdit}
                        checked={event.status === "done"}
                        label={`${event.status === "done" ? "Reopen" : "Complete"} ${event.title}`}
                        onClick={() =>
                          saveEntry(
                            {
                              ...event,
                              status:
                                event.status === "done" ? "pending" : "done",
                            },
                            event.id,
                          ).catch((e) =>
                            toast.error(e.message, { duration: Infinity }),
                          )
                        }
                      />
                    ) : (
                      <Receipt size={16} />
                    )}
                    <button
                      onClick={() => openEntry(event)}
                      className={
                        event.status === "done" ? "completed-text" : ""
                      }
                    >
                      {event.title}
                    </button>
                  </div>
                  <span className="category-badge">
                    {event.kind === "invoice"
                      ? money(event.amount, workspace.company?.currency)
                      : event.category}
                  </span>
                  {event.data.recurrence !== "none" &&
                    Boolean(event.data.recurrence) && (
                      <small className="muted">
                        Repeats {String(event.data.recurrence)}
                      </small>
                    )}
                </div>
              </div>
            ))}
            {!visible.length && (
              <Empty
                title="A little breathing room"
                description={
                  selected
                    ? "Nothing planned for this date. Add a reminder to get ahead."
                    : "Nothing planned for this month."
                }
                icon={<CalendarDays size={25} />}
                action={
                  <Button
                    variant="outline"
                    disabled={!canEdit}
                    onClick={() =>
                      createEntry("event", {
                        date: selected || format(month, "yyyy-MM-dd"),
                      })
                    }
                  >
                    <Plus size={15} />
                    Add reminder
                  </Button>
                }
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
