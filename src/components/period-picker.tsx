import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import { Button } from "./ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "./ui/dropdown-menu";
import { Dialog } from "./ui/dialog";
import { Field, Input } from "./ui/input";

export function usePeriod() {
  const [period, setPeriod] = useState({
    label: "This month",
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });
  return { period, setPeriod };
}
export function PeriodPicker({
  period,
  onChange,
}: {
  period: { label: string; from: string; to: string };
  onChange: (value: { label: string; from: string; to: string }) => void;
}) {
  const [custom, setCustom] = useState(false),
    [from, setFrom] = useState(period.from),
    [to, setTo] = useState(period.to),
    now = new Date();
  const options = [
    { label: "This month", start: startOfMonth(now), end: endOfMonth(now) },
    {
      label: "Last month",
      start: startOfMonth(addMonths(now, -1)),
      end: endOfMonth(addMonths(now, -1)),
    },
    {
      label: "This quarter",
      start: startOfQuarter(now),
      end: endOfQuarter(now),
    },
    { label: "This year", start: startOfYear(now), end: endOfYear(now) },
  ];
  return (
    <>
      <Dropdown
        trigger={
          <Button variant="outline" className="period-button">
            <CalendarDays size={15} />
            {period.label}
            <ChevronDown size={14} />
          </Button>
        }
      >
        {options.map((o) => (
          <DropdownItem
            key={o.label}
            onSelect={() =>
              onChange({
                label: o.label,
                from: format(o.start, "yyyy-MM-dd"),
                to: format(o.end, "yyyy-MM-dd"),
              })
            }
          >
            {o.label}
            {period.label === o.label && (
              <Check size={14} className="ml-auto" />
            )}
          </DropdownItem>
        ))}
        <DropdownItem
          onSelect={() => onChange({ label: "All time", from: "", to: "" })}
        >
          All time
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => setCustom(true)}>
          Custom period…
        </DropdownItem>
      </Dropdown>
      <Dialog open={custom} onOpenChange={setCustom} title="Choose a period">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChange({
              label: `${format(new Date(from + "T12:00:00"), "dd MMM")} – ${format(new Date(to + "T12:00:00"), "dd MMM yyyy")}`,
              from,
              to,
            });
            setCustom(false);
          }}
        >
          <div className="dialog-body form-grid">
            <Field label="From">
              <Input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                min={from}
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <div className="dialog-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustom(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Apply period</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
