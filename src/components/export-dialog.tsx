import { useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { Select } from "./ui/select";
import type { Workspace, Kind } from "@/lib/types";
import { exportWorkspace } from "@/lib/export";
import { cn } from "@/lib/utils";

export function ExportDialog({
  open,
  onClose,
  workspace,
  initialKind = "all",
  initialFrom = "",
  initialTo = "",
}: {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
  initialKind?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [format, setFormat] = useState("xlsx"),
    [kind, setKind] = useState(initialKind),
    [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [busy, setBusy] = useState(false);
  const records = workspace.entries.filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to),
  );
  const formats = [
    {
      value: "xlsx",
      label: "Spreadsheet",
      hint: "Excel · separate tabs",
      icon: FileSpreadsheet,
    },
    {
      value: "csv",
      label: "CSV",
      hint: "Open in any sheet app",
      icon: FileSpreadsheet,
    },
    {
      value: "json",
      label: "JSON",
      hint: "Portable structured data",
      icon: FileJson,
    },
    {
      value: "zip",
      label: "Complete archive",
      hint: "Records, PDFs & files",
      icon: Archive,
    },
    {
      value: "ics",
      label: "Calendar",
      hint: "Events & invoice due dates",
      icon: CalendarDays,
    },
  ];
  const run = async () => {
    if (from && to && from > to)
      return toast.error("The end date must be after the start date.", {
        duration: Infinity,
      });
    setBusy(true);
    try {
      await exportWorkspace(workspace, records, format);
      toast.success("Your export is ready.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message, { duration: Infinity });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Take your work with you"
      description="Your company’s data belongs to you. Export exactly what you need."
    >
      <div className="dialog-body">
        <div className="export-formats">
          {formats.map((f) => (
            <button
              key={f.value}
              className={cn("export-format", format === f.value && "selected")}
              onClick={() => setFormat(f.value)}
            >
              <f.icon size={20} />
              <span>
                <strong>{f.label}</strong>
                <small>{f.hint}</small>
              </span>
              {format === f.value && <Check size={16} />}
            </button>
          ))}
        </div>
        <Field label="Include">
          <Select
            label="Records to export"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "all", label: "Everything in this company" },
              ...(
                [
                  "transaction",
                  "invoice",
                  "event",
                  "document",
                  "note",
                  "contact",
                ] as Kind[]
              ).map((k) => ({
                value: k,
                label: k[0].toUpperCase() + k.slice(1) + "s",
              })),
            ]}
          />
        </Field>
        <div className="form-grid">
          <Field label="From" hint="Leave empty for all time">
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <p className="export-summary">
          {records.length} records selected · {workspace.company?.name}
        </p>
      </div>
      <div className="dialog-footer">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={run}>
          {busy ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Download size={16} />
          )}
          {busy ? "Preparing export…" : "Export data"}
        </Button>
      </div>
    </Dialog>
  );
}
