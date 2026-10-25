import { DataTable } from "./ui/data-table";
import { useState } from "react";
import { Download, Loader2, Pencil, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Status } from "./common";
import {
  recordedInvoiceTotals,
  invoiceLineAmount,
  invoiceStatus,
} from "@/lib/invoices";
import { useWorkspace } from "@/lib/workspace-context";
import { api } from "@/lib/api";
import { download, invoicePdf } from "@/lib/export";
import { money, shortDate } from "@/lib/utils";
import type { Entry, InvoiceLine } from "@/lib/types";

export function InvoiceDetail({
  entry,
  onClose,
  onEdit,
}: {
  entry: Entry;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { workspace, reload, saveEntry, canEdit } = useWorkspace(),
    [busy, setBusy] = useState(false);
  const company = workspace.company!,
    lines = (entry.data.lines as InvoiceLine[]) || [],
    { subtotal, tax } = recordedInvoiceTotals(entry);
  const exportPdf = async () => {
    try {
      download(
        await invoicePdf(entry, company),
        `${entry.data.number}.pdf`,
        "application/pdf",
      );
      toast.success("Invoice downloaded.");
    } catch {
      toast.error("Unable to generate the invoice. Please try again.", {
        duration: Infinity,
      });
    }
  };
  const pay = async () => {
    setBusy(true);
    try {
      await api(`entries/${entry.id}/pay`, { method: "POST" }, company.id);
      await reload();
      toast.success("Payment recorded. Your accounts are up to date.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message, { duration: Infinity });
    } finally {
      setBusy(false);
    }
  };
  const markSent = async () => {
    setBusy(true);
    try {
      await saveEntry({ ...entry, status: "sent" }, entry.id);
      onClose();
    } catch (e) {
      toast.error((e as Error).message, { duration: Infinity });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={String(entry.data.number)}
      description={entry.title}
      size="wide"
    >
      <div className="dialog-body invoice-preview">
        <div className="invoice-top">
          <div>
            <h2>{company.name}</h2>
            <p className="preserve-lines">{company.address}</p>
            <p>{company.email}</p>
            <p>{company.taxId}</p>
          </div>
          <div>
            <span className="invoice-word">
              {entry.data.direction === "payable" ? "Supplier bill" : "Invoice"}
            </span>
            <Status value={invoiceStatus(entry)} />
          </div>
        </div>
        <div className="invoice-address">
          <div>
            <span className="field-hint">
              {entry.data.direction === "payable" ? "Supplier" : "Bill to"}
            </span>
            <strong>{String(entry.data.client)}</strong>
            <span>{String(entry.data.clientEmail || "")}</span>
          </div>
          <div>
            <span className="field-hint">Issued</span>
            <strong>
              {shortDate(String(entry.data.issuedDate || entry.date))}
            </strong>
            <span className="field-hint">Due {shortDate(entry.date)}</span>
          </div>
        </div>
        <DataTable
          variant="invoice"
          rows={lines}
          rowKey={(_row, i) => i}
          columns={[
            {
              id: "description",
              header: "Description",
              cell: (line) => line.description,
            },
            {
              id: "quantity",
              header: "Qty",
              cell: (line) => line.quantity,
            },
            {
              id: "amount",
              header: "Amount",
              cell: (line) => money(invoiceLineAmount(line), company.currency),
              align: "right",
              cellClassName: "right",
            },
          ]}
        />
        <div className="invoice-totals">
          <p>
            <span>Subtotal</span>
            {money(subtotal, company.currency)}
          </p>
          <p>
            <span>VAT ({String(entry.data.taxRate)}%)</span>
            {money(tax, company.currency)}
          </p>
          <strong>
            <span>Amount due</span>
            {money(entry.amount, company.currency)}
          </strong>
        </div>
        {Boolean(entry.data.notes) && (
          <p className="muted preserve-lines">{String(entry.data.notes)}</p>
        )}
        {Boolean(entry.data.paymentDetails) && (
          <div className="payment-details">
            <span className="field-hint">Payment details</span>
            <p>{String(entry.data.paymentDetails)}</p>
          </div>
        )}
        {entry.status === "paid" && (
          <div className="success-message">
            <Check size={17} />
            {entry.data.direction === "payable"
              ? "Payment made"
              : "Payment received"}
            {entry.data.paidAt
              ? ` on ${shortDate(String(entry.data.paidAt).slice(0, 10))}`
              : ""}
            .
          </div>
        )}
      </div>
      <div className="dialog-footer">
        <Button variant="outline" onClick={exportPdf}>
          <Download size={15} />
          Download PDF
        </Button>
        {canEdit && entry.status !== "paid" && (
          <>
            <Button variant="ghost" onClick={onEdit}>
              <Pencil size={15} />
              Edit
            </Button>
            <Button
              disabled={busy}
              onClick={entry.status === "draft" ? markSent : pay}
            >
              {busy ? (
                <Loader2 className="spin" size={15} />
              ) : entry.status === "draft" ? (
                <Send size={15} />
              ) : (
                <Check size={15} />
              )}
              {entry.status === "draft"
                ? entry.data.direction === "payable"
                  ? "Mark as received"
                  : "Mark as sent"
                : "Record payment"}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
