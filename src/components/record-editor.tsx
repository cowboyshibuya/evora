import { calculateInvoiceTotals } from "@/lib/invoices";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/input";
import { Select } from "./ui/select";
import { useWorkspace } from "@/lib/workspace-context";
import { money, today } from "@/lib/utils";
import type { Entry, EntryInput, InvoiceLine, Kind } from "@/lib/types";

const transactionCategories = [
  "Client work",
  "Sales",
  "Software",
  "Office",
  "Payroll",
  "Travel",
  "Equipment",
  "Professional services",
  "Tax",
  "Other",
];
const titles: Record<Kind, string> = {
  transaction: "transaction",
  invoice: "invoice",
  event: "reminder",
  note: "note",
  contact: "contact",
  document: "document",
};
export function RecordEditor({
  kind,
  entry,
  defaults,
  onClose,
}: {
  kind: Kind;
  entry?: Entry;
  defaults?: Partial<EntryInput>;
  onClose: () => void;
}) {
  const { workspace, saveEntry, canEdit } = useWorkspace();
  const initial = {
    title: "",
    date: today(),
    amount: 0,
    category:
      kind === "event"
        ? "Accounting"
        : kind === "transaction"
          ? "Client work"
          : kind === "note"
            ? "General"
            : kind === "contact"
              ? "Client"
              : kind === "document"
                ? "Company"
                : "Services",
    status:
      kind === "event"
        ? "pending"
        : kind === "invoice"
          ? "draft"
          : kind === "transaction"
            ? "completed"
            : "active",
    data: {},
    ...defaults,
    ...entry,
  };
  const [title, setTitle] = useState(initial.title),
    [date, setDate] = useState(initial.date),
    [category, setCategory] = useState(initial.category),
    [status, setStatus] = useState(initial.status);
  const [amount, setAmount] = useState(Math.abs(initial.amount) / 100 + ""),
    [direction, setDirection] = useState(
      initial.amount < 0 ? "expense" : "income",
    );
  const [data, setData] = useState<Record<string, unknown>>({
    issuedDate: today(),
    direction: "receivable",
    taxRate: 21,
    recurrence: "none",
    time: "09:00",
    number: `INV-${new Date().getFullYear()}-${String(Math.max(0, ...workspace.entries.filter((e) => e.kind === "invoice").map((e) => Number(String(e.data.number).split("-").at(-1)) || 0)) + 1).padStart(3, "0")}`,
    ...initial.data,
  });
  const [lines, setLines] = useState<InvoiceLine[]>(
    (initial.data.lines as InvoiceLine[]) || [
      { description: "", quantity: 1, unitPrice: 0 },
    ],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const put = (key: string, value: unknown) =>
    setData((current) => ({ ...current, [key]: value }));
  const {
    subtotal,
    tax,
    total: invoiceTotal,
  } = calculateInvoiceTotals(lines, Number(data.taxRate || 0));
  const changeLine = (
    index: number,
    field: keyof InvoiceLine,
    value: string | number,
  ) =>
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: value } : line,
      ),
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const total =
        kind === "invoice"
          ? invoiceTotal
          : kind === "transaction"
            ? Math.round(Number(amount) * 100) *
              (direction === "expense" ? -1 : 1)
            : 0;
      await saveEntry(
        {
          kind,
          title,
          date,
          amount: total,
          category,
          status,
          data: { ...data, ...(kind === "invoice" ? { lines } : {}) },
        },
        entry?.id,
      );
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${entry ? "Edit" : "New"} ${titles[kind]}`}
      description={
        kind === "invoice"
          ? "A clear invoice, ready to send to your client."
          : kind === "note"
            ? "A little space for the things worth keeping."
            : `Keep your company’s ${titles[kind]} in one place.`
      }
      size={kind === "invoice" ? "wide" : kind === "note" ? "note" : "default"}
    >
      <form onSubmit={submit}>
        <fieldset
          className="dialog-body"
          disabled={!canEdit || Boolean(entry?.data.invoiceId)}
        >
          {kind === "transaction" && (
            <div className="segmented-control">
              {["income", "expense"].map((d) => (
                <button
                  type="button"
                  className={direction === d ? "active" : ""}
                  onClick={() => {
                    setDirection(d);
                    if (!entry)
                      setCategory(d === "income" ? "Client work" : "Software");
                  }}
                  key={d}
                >
                  {d === "income" ? "Money in" : "Money out"}
                </button>
              ))}
            </div>
          )}
          <Field
            label={
              kind === "contact"
                ? "Company or contact name"
                : kind === "invoice"
                  ? "Invoice description"
                  : "Title"
            }
          >
            <Input
              required
              autoFocus
              maxLength={240}
              placeholder={
                kind === "note"
                  ? "Give your note a title"
                  : kind === "invoice"
                    ? "e.g. Website design & development"
                    : kind === "event"
                      ? "e.g. Prepare annual financial statements"
                      : kind === "transaction"
                        ? "e.g. Monthly design retainer"
                        : "e.g. Acme Studio"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {kind === "transaction" && (
            <>
              <div className="form-grid">
                <Field label={`Amount (${workspace.company?.currency})`}>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Transaction date">
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Category">
                  <Select
                    label="Transaction category"
                    value={category}
                    onValueChange={setCategory}
                    options={transactionCategories}
                  />
                </Field>
                <Field label="Payment method">
                  <Select
                    label="Payment method"
                    value={String(data.method || "Bank transfer")}
                    onValueChange={(v) => put("method", v)}
                    options={["Bank transfer", "Card", "Cash", "Other"]}
                  />
                </Field>
              </div>
              <Field label="Client or supplier">
                <Input
                  value={String(data.counterparty || "")}
                  onChange={(e) => put("counterparty", e.target.value)}
                  placeholder="Company name"
                />
              </Field>
              <NotesField
                label="Notes"
                rows={3}
                value={String(data.notes || "")}
                onValueChange={(value) => put("notes", value)}
                placeholder="Add a reference or a little context…"
              />
            </>
          )}
          {kind === "invoice" && (
            <>
              <Field label="Invoice type">
                <Select
                  label="Invoice type"
                  value={String(data.direction)}
                  onValueChange={(v) => {
                    put("direction", v);
                    setCategory(
                      v === "payable" ? "Professional services" : "Services",
                    );
                  }}
                  options={[
                    {
                      value: "receivable",
                      label: "Sales invoice · money coming in",
                    },
                    {
                      value: "payable",
                      label: "Supplier bill · money going out",
                    },
                  ]}
                />
              </Field>
              <div className="form-grid">
                <Field
                  label={
                    data.direction === "payable"
                      ? "Supplier name"
                      : "Client name"
                  }
                >
                  <Input
                    required
                    value={String(data.client || "")}
                    onChange={(e) => put("client", e.target.value)}
                    placeholder="Acme Studio"
                    list="client-list"
                  />
                  <datalist id="client-list">
                    {workspace.entries
                      .filter((e) => e.kind === "contact")
                      .map((c) => (
                        <option key={c.id} value={c.title} />
                      ))}
                  </datalist>
                </Field>
                <Field
                  label={
                    data.direction === "payable"
                      ? "Supplier email"
                      : "Client email"
                  }
                >
                  <Input
                    type="email"
                    required
                    value={String(data.clientEmail || "")}
                    onChange={(e) => put("clientEmail", e.target.value)}
                    placeholder="accounts@acme.com"
                  />
                </Field>
              </div>
              <div className="form-grid three">
                <Field label="Invoice number">
                  <Input
                    required
                    value={String(data.number)}
                    onChange={(e) => put("number", e.target.value)}
                  />
                </Field>
                <Field label="Issue date">
                  <Input
                    type="date"
                    required
                    value={String(data.issuedDate)}
                    onChange={(e) => put("issuedDate", e.target.value)}
                  />
                </Field>
                <Field label="Due date">
                  <Input
                    type="date"
                    required
                    value={date}
                    min={String(data.issuedDate)}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <div className="line-items">
                <div className="line-labels">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit price</span>
                  <span />
                </div>
                {lines.map((line, i) => (
                  <div className="line-item" key={i}>
                    <Input
                      required
                      aria-label={`Line ${i + 1} description`}
                      value={line.description}
                      placeholder="Service or product"
                      onChange={(e) =>
                        changeLine(i, "description", e.target.value)
                      }
                    />
                    <Input
                      required
                      aria-label={`Line ${i + 1} quantity`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) =>
                        changeLine(i, "quantity", Number(e.target.value))
                      }
                    />
                    <Input
                      required
                      aria-label={`Line ${i + 1} unit price`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice / 100}
                      onChange={(e) =>
                        changeLine(
                          i,
                          "unitPrice",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove line ${i + 1}`}
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) => current.filter((_, n) => i !== n))
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((l) => [
                      ...l,
                      { description: "", quantity: 1, unitPrice: 0 },
                    ])
                  }
                >
                  <Plus size={15} />
                  Add line item
                </Button>
              </div>
              <div className="invoice-editor-total">
                <Field label="VAT rate (%)">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={Number(data.taxRate)}
                    onChange={(e) => put("taxRate", Number(e.target.value))}
                  />
                </Field>
                <div>
                  <p>
                    <span>Subtotal</span>
                    {money(subtotal, workspace.company?.currency)}
                  </p>
                  <p>
                    <span>VAT</span>
                    {money(tax, workspace.company?.currency)}
                  </p>
                  <strong>
                    <span>Total</span>
                    {money(invoiceTotal, workspace.company?.currency)}
                  </strong>
                </div>
              </div>
              {data.direction === "payable" && (
                <Field label="Expense category">
                  <Select
                    label="Bill expense category"
                    value={category}
                    onValueChange={setCategory}
                    options={transactionCategories.filter(
                      (c) => !["Client work", "Sales"].includes(c),
                    )}
                  />
                </Field>
              )}
              <Field label="Payment details">
                <Input
                  value={String(data.paymentDetails || "")}
                  onChange={(e) => put("paymentDetails", e.target.value)}
                  placeholder="IBAN, payment reference, or instructions"
                />
              </Field>
              <NotesField
                label="Notes for your client"
                rows={2}
                value={String(data.notes || "")}
                onValueChange={(value) => put("notes", value)}
                placeholder="Thank you for your trust."
              />
              <Field label="Status">
                <Select
                  label="Invoice status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "draft", label: "Draft" },
                    { value: "sent", label: "Sent · awaiting payment" },
                  ]}
                />
              </Field>
            </>
          )}
          {kind === "event" && (
            <>
              <div className="form-grid">
                <Field label="Due date">
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <Field label="Time">
                  <Input
                    type="time"
                    value={String(data.time)}
                    onChange={(e) => put("time", e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-grid">
                <Field label="Category">
                  <Select
                    label="Reminder category"
                    value={category}
                    onValueChange={setCategory}
                    options={[
                      "Accounting",
                      "Tax",
                      "Annual balance",
                      "Payroll",
                      "Renewal",
                      "Meeting",
                      "Other",
                    ]}
                  />
                </Field>
                <Field label="Repeat">
                  <Select
                    label="Repeat reminder"
                    value={String(data.recurrence)}
                    onValueChange={(v) => put("recurrence", v)}
                    options={[
                      { value: "none", label: "Does not repeat" },
                      { value: "monthly", label: "Every month" },
                      { value: "yearly", label: "Every year" },
                    ]}
                  />
                </Field>
              </div>
              <Field label="Details">
                <Textarea
                  rows={4}
                  placeholder="What needs to be prepared?"
                  value={String(data.description || "")}
                  onChange={(e) => put("description", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <Select
                  label="Reminder status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "pending", label: "To do" },
                    { value: "done", label: "Done" },
                  ]}
                />
              </Field>
            </>
          )}
          {kind === "note" && (
            <>
              <Textarea
                className="note-editor"
                aria-label="Note content"
                rows={12}
                value={String(data.content || "")}
                onChange={(e) => put("content", e.target.value)}
                placeholder="Start writing. Everything has a place here…"
              />
              <div className="form-grid">
                <Field label="Collection">
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    list="note-categories"
                  />
                  <datalist id="note-categories">
                    {["General", "Planning", "Finance", "Ideas", "Team"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </datalist>
                </Field>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(data.pinned)}
                    onChange={(e) => put("pinned", e.target.checked)}
                  />
                  Pin this note
                </label>
              </div>
            </>
          )}
          {kind === "contact" && (
            <>
              <div className="form-grid">
                <Field label="Contact person">
                  <Input
                    value={String(data.person || "")}
                    onChange={(e) => put("person", e.target.value)}
                    placeholder="Alex Morgan"
                  />
                </Field>
                <Field label="Relationship">
                  <Select
                    label="Relationship"
                    value={category}
                    onValueChange={setCategory}
                    options={[
                      "Client",
                      "Supplier",
                      "Partner",
                      "Accountant",
                      "Other",
                    ]}
                  />
                </Field>
              </div>
              <Field label="Email">
                <Input
                  type="email"
                  value={String(data.email || "")}
                  onChange={(e) => put("email", e.target.value)}
                  placeholder="hello@company.com"
                />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={String(data.phone || "")}
                  onChange={(e) => put("phone", e.target.value)}
                  placeholder="+32 470 12 34 56"
                />
              </Field>
              <Field label="Address">
                <Textarea
                  rows={3}
                  value={String(data.address || "")}
                  onChange={(e) => put("address", e.target.value)}
                />
              </Field>
              <NotesField
                label="Notes"
                rows={3}
                value={String(data.notes || "")}
                onValueChange={(value) => put("notes", value)}
              />
            </>
          )}
          {kind === "document" && (
            <Field label="Folder">
              <Select
                label="Document folder"
                value={category}
                onValueChange={setCategory}
                options={[
                  "Company",
                  "Finance",
                  "Contracts",
                  "Receipts",
                  "Other",
                ]}
              />
            </Field>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </fieldset>
        <div className="dialog-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !canEdit || Boolean(entry?.data.invoiceId)}
            type="submit"
          >
            {busy && <Loader2 size={15} className="spin" />}
            {entry
              ? "Save changes"
              : kind === "invoice"
                ? status === "draft"
                  ? "Create draft"
                  : "Create invoice"
                : `Add ${titles[kind]}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NotesField({
  label,
  rows,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  rows: number;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
      />
    </Field>
  );
}
