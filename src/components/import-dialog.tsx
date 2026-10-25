import { DataTable } from "./ui/data-table";
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { download } from "@/lib/export";
import { money } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field } from "./ui/input";
import { Select } from "./ui/select";
import type { EntryInput } from "@/lib/types";
import { entryInput } from "@/lib/validation";

const guess = (headers: string[], words: string[]) =>
  headers.find((h) => words.includes(h.toLowerCase())) || "none";
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { workspace, reload } = useWorkspace(),
    input = useRef<HTMLInputElement>(null),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [headers, setHeaders] = useState<string[]>([]),
    [filename, setFilename] = useState(""),
    [hash, setHash] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [mapping, setMapping] = useState({
    title: "none",
    date: "none",
    amount: "none",
    category: "none",
  });
  const read = async (file: File) => {
    setError("");
    if (file.size > 2 * 1048576)
      return setError("Choose a CSV smaller than 2 MB.");
    const text = await file.text(),
      parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
      }),
      keys = parsed.meta.fields || [];
    if (parsed.errors.length)
      return setError(`Unable to read this CSV: ${parsed.errors[0].message}`);
    if (!parsed.data.length || parsed.data.length > 100)
      return setError("Choose a CSV with between 1 and 100 transactions.");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    setHash(
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
    setRows(parsed.data);
    setHeaders(keys);
    setFilename(file.name);
    setMapping({
      title: guess(keys, ["title", "description", "name", "reference"]),
      date: guess(keys, ["date", "transaction date"]),
      amount: guess(keys, ["amount", "amount (minor units)", "total"]),
      category: guess(keys, ["category"]),
    });
  };
  const { records, errors } = useMemo(() => {
    const records: EntryInput[] = [],
      errors: string[] = [];
    if (
      ["title", "date", "amount"].some(
        (k) => mapping[k as keyof typeof mapping] === "none",
      )
    )
      return {
        records,
        errors: ["Match a description, date, and amount column to continue."],
      };
    rows.forEach((row, i) => {
      const raw = (row[mapping.amount] || "").trim().replace(/[€$£\s]/g, ""),
        amount = Number(
          raw.includes(",") && raw.lastIndexOf(",") > raw.lastIndexOf(".")
            ? raw.replaceAll(".", "").replace(",", ".")
            : raw.replaceAll(",", ""),
        );
      const candidate = {
        kind: "transaction",
        title: row[mapping.title],
        date: row[mapping.date],
        amount: Math.round(
          amount * (mapping.amount.toLowerCase().includes("minor") ? 1 : 100),
        ),
        category:
          row[mapping.category] || (amount > 0 ? "Client work" : "Other"),
        status: "completed",
        data: { method: "Imported", importFile: filename },
      };
      const parsed = entryInput.safeParse(candidate);
      if (!raw || !Number.isFinite(amount) || !parsed.success)
        errors.push(
          `Row ${i + 2}: ${!raw || !Number.isFinite(amount) ? "Enter a valid amount." : parsed.error?.issues[0].message}`,
        );
      else records.push(parsed.data);
    });
    return { records, errors };
  }, [rows, mapping, filename]);
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ imported: number }>(
        "import",
        { method: "POST", body: JSON.stringify({ records, hash }) },
        workspace.company!.id,
      );
      await reload();
      toast.success(`${result.imported} transactions imported.`);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Bring your books along."
      description="Import transactions from a CSV exported by your spreadsheet or bank."
      size={rows.length ? "wide" : "default"}
    >
      <div className="dialog-body">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Import CSV file"
          onChange={(e) => {
            if (e.target.files?.[0]) read(e.target.files[0]);
            e.target.value = "";
          }}
        />
        {!rows.length ? (
          <>
            <button
              className="import-dropzone"
              onClick={() => input.current?.click()}
            >
              <FileSpreadsheet size={32} />
              <strong>Choose a CSV file</strong>
              <span>Up to 100 transactions · 2 MB maximum</span>
            </button>
            <p className="field-hint">
              Use ISO dates (YYYY-MM-DD). Amounts are in{" "}
              {workspace.company?.currency}: positive for income, negative for
              expenses. Match your columns before importing.
            </p>
            <Button
              variant="ghost"
              onClick={() =>
                download(
                  "Description,Date,Amount,Category\nClient payment,2026-10-19,1500.00,Client work\nSoftware subscription,2026-10-19,-49.00,Software\n",
                  "evora-import-template.csv",
                  "text/csv",
                )
              }
            >
              <Download size={14} />
              Download a template
            </Button>
          </>
        ) : (
          <>
            <div className="import-file">
              <FileSpreadsheet size={20} />
              <span>
                <strong>{filename}</strong>
                <small>{rows.length} rows found</small>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => input.current?.click()}
              >
                Change file
              </Button>
            </div>
            <div className="form-grid">
              {(
                [
                  { key: "title", label: "Description column" },
                  { key: "date", label: "Date column" },
                  { key: "amount", label: "Amount column" },
                  { key: "category", label: "Category column (optional)" },
                ] as const
              ).map((m) => (
                <Field label={m.label} key={m.key}>
                  <Select
                    label={m.label}
                    value={mapping[m.key]}
                    onValueChange={(value) =>
                      setMapping((current) => ({ ...current, [m.key]: value }))
                    }
                    options={[
                      { value: "none", label: "Choose a column" },
                      ...headers,
                    ]}
                  />
                </Field>
              ))}
            </div>
            {errors.length ? (
              <div className="form-error" role="alert">
                {errors.slice(0, 5).map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
                {errors.length > 5 && (
                  <p>And {errors.length - 5} more rows to check.</p>
                )}
              </div>
            ) : (
              <div className="success-message">
                <Check size={16} />
                {records.length} transactions ready. Review the preview below.
              </div>
            )}
            <DataTable
              rows={records.slice(0, 6)}
              rowKey={(_row, i) => i}
              columns={[
                {
                  id: "description",
                  header: "Description",
                  cell: (r) => r.title,
                },
                { id: "date", header: "Date", cell: (r) => r.date },
                {
                  id: "category",
                  header: "Category",
                  cell: (r) => r.category,
                },
                {
                  id: "amount",
                  header: "Amount",
                  cell: (r) => money(r.amount, workspace.company?.currency),
                  align: "right",
                  cellClassName: "right",
                },
              ]}
            />
            <p className="field-hint">
              Importing the same file twice will not create duplicate
              transactions.
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {rows.length > 0 && (
          <Button disabled={busy || errors.length > 0} onClick={submit}>
            {busy ? (
              <Loader2 className="spin" size={15} />
            ) : (
              <Upload size={15} />
            )}
            Import {records.length} transactions
          </Button>
        )}
      </div>
    </Dialog>
  );
}
