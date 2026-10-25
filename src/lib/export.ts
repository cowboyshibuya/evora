import { invoiceLineAmount, recordedInvoiceTotals } from "./invoices";
import { format } from "date-fns";
import type { Company, Entry, InvoiceLine, Kind, Workspace } from "./types";
import { money } from "./utils";

export function download(
  content: BlobPart | Uint8Array,
  filename: string,
  mime = "text/plain",
) {
  const body =
    content instanceof Uint8Array ? new Uint8Array(content) : content;
  const blob = new Blob([body], { type: mime }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safe = (value: unknown) => {
  const text = String(value ?? "");
  return /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
};
const rowsFor = (records: Entry[]) =>
  records.map((e) => ({
    Title: e.title,
    Date: e.date,
    Type: e.kind,
    Category: e.category,
    Status: e.status,
    "Amount (minor units)": e.amount,
    ...Object.fromEntries(
      Object.entries(e.data)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : v]),
    ),
  }));
export function toCsv(records: Entry[]) {
  const rows = rowsFor(records),
    columns = [...new Set(rows.flatMap((r) => Object.keys(r)))],
    encode = (v: unknown) => `"${safe(v).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [
      columns.map(encode).join(","),
      ...rows.map((row) =>
        columns
          .map((c) => encode((row as Record<string, unknown>)[c]))
          .join(","),
      ),
    ].join("\r\n")
  );
}
export function calendarExport(records: Entry[]) {
  const escape = (v: string) =>
    v
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const fold = (line: string) => {
    let result = "",
      chunk = "",
      bytes = 0;
    for (const c of line) {
      const size = new TextEncoder().encode(c).length;
      if (bytes + size > 74) {
        result += chunk + "\r\n ";
        chunk = "";
        bytes = 1;
      }
      chunk += c;
      bytes += size;
    }
    return result + chunk;
  };
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Evora//Company calendar//EN",
      "CALSCALE:GREGORIAN",
      ...records
        .filter((e) => e.kind === "event" || e.kind === "invoice")
        .flatMap((e) => [
          "BEGIN:VEVENT",
          `UID:${e.id}@evora`,
          `DTSTAMP:${new Date()
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}Z$/, "Z")}`,
          `DTSTART;VALUE=DATE:${e.date.replaceAll("-", "")}`,
          `SUMMARY:${escape(e.status === "done" ? `[Completed] ${e.title}` : e.title)}`,
          `DESCRIPTION:${escape(String(e.data.description || e.data.notes || ""))}`,
          ...(e.status !== "done" && e.data.recurrence === "yearly"
            ? ["RRULE:FREQ=YEARLY"]
            : e.status !== "done" && e.data.recurrence === "monthly"
              ? ["RRULE:FREQ=MONTHLY"]
              : []),
          "END:VEVENT",
        ]),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
export async function exportWorkspace(
  workspace: Workspace,
  records: Entry[],
  output: string,
) {
  const base = `${workspace.company!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${format(new Date(), "yyyy-MM-dd")}`;
  if (output === "csv")
    return download(toCsv(records), `${base}.csv`, "text/csv;charset=utf-8");
  if (output === "json")
    return download(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          company: workspace.company,
          team: workspace.members,
          entries: records,
        },
        null,
        2,
      ),
      `${base}.json`,
      "application/json",
    );
  if (output === "ics")
    return download(calendarExport(records), `${base}.ics`, "text/calendar");
  if (output === "xlsx") {
    const ExcelJS = await import("exceljs"),
      workbook = new ExcelJS.Workbook();
    workbook.creator = "Evora";
    workbook.created = new Date();
    const details = workbook.addWorksheet("Company");
    details.columns = [
      { header: "Field", key: "field", width: 24 },
      { header: "Value", key: "value", width: 60 },
    ];
    details.addRows(
      Object.entries(workspace.company!).map(([field, value]) => ({
        field,
        value,
      })),
    );
    for (const kind of [
      "transaction",
      "invoice",
      "event",
      "note",
      "contact",
      "document",
    ] as Kind[]) {
      const rows = rowsFor(records.filter((e) => e.kind === kind));
      if (kind === "invoice")
        for (const row of rows) delete (row as Record<string, unknown>).lines;
      if (!rows.length) continue;
      const sheet = workbook.addWorksheet(
          kind[0].toUpperCase() + kind.slice(1) + "s",
        ),
        keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      sheet.columns = keys.map((key) => ({
        header: key,
        key,
        width: key === "Title" ? 42 : 24,
      }));
      sheet.addRows(rows);
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF277455" },
      };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: keys.length },
      };
    }
    const selectedInvoices = records.filter((e) => e.kind === "invoice");
    if (selectedInvoices.length) {
      const items = workbook.addWorksheet("Invoice items");
      items.columns = [
        "Invoice number",
        "Client or supplier",
        "Description",
        "Quantity",
        "Unit price (minor units)",
        "Total (minor units)",
        "VAT rate",
        "Currency",
      ].map((key) => ({
        header: key,
        key,
        width: key === "Description" ? 48 : 24,
      }));
      for (const invoice of selectedInvoices)
        for (const line of invoice.data.lines as InvoiceLine[])
          items.addRow({
            "Invoice number": invoice.data.number,
            "Client or supplier": invoice.data.client,
            Description: line.description,
            Quantity: line.quantity,
            "Unit price (minor units)": line.unitPrice,
            "Total (minor units)": invoiceLineAmount(line),
            "VAT rate": invoice.data.taxRate,
            Currency: workspace.company!.currency,
          });
      items.getRow(1).font = { bold: true };
      items.views = [{ state: "frozen", ySplit: 1 }];
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return download(
      new Uint8Array(buffer),
      `${base}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  }
  if (output === "zip") {
    const { default: JSZip } = await import("jszip"),
      zip = new JSZip();
    zip.file("company.json", JSON.stringify(workspace.company, null, 2));
    zip.file("team.json", JSON.stringify(workspace.members, null, 2));
    zip.file("records.json", JSON.stringify(records, null, 2));
    zip.file("records.csv", toCsv(records));
    zip.file("calendar.ics", calendarExport(records));
    zip.file(
      "README.txt",
      `Exported from Evora on ${new Date().toISOString()}.\nCompany: ${workspace.company!.name}\nAmounts in CSV/JSON use integer minor units (cents). Currency: ${workspace.company!.currency}.\nThe archive contains all selected records, notes and original documents.\n`,
    );
    for (const entry of records) {
      const filename = entry.title.replace(/[/\\:*?"<>|]/g, "_");
      if (entry.kind === "note")
        zip.file(
          `notes/${filename}-${entry.id.slice(0, 6)}.md`,
          `# ${entry.title}\n\n${entry.data.content || ""}\n`,
        );
      if (entry.kind === "document") {
        const response = await fetch(
          `/api/entries/${entry.id}/download?company=${workspace.company!.id}`,
        );
        if (!response.ok)
          throw new Error(`Unable to export ${entry.title}. Please try again.`);
        zip.file(
          `documents/${entry.id.slice(0, 6)}-${filename}`,
          await response.arrayBuffer(),
        );
      }
      if (entry.kind === "invoice")
        zip.file(
          `invoices/${String(entry.data.number).replace(/[/\\:*?"<>|]/g, "_")}-${entry.id.slice(0, 6)}.pdf`,
          await invoicePdf(entry, workspace.company!),
        );
    }
    download(
      await zip.generateAsync({ type: "uint8array" }),
      `${base}.zip`,
      "application/zip",
    );
  }
}
export async function invoicePdf(entry: Entry, company: Company) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib"),
    pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]),
    y = 785;
  const supported = new Set(font.getCharacterSet());
  const clean = (value: unknown) =>
    Array.from(String(value ?? ""))
      .map((c) => (c === "\n" || supported.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const wrap = (value: unknown, width: number, size = 11) => {
    const result: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let line = "";
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(line + character, size) > width && line) {
          result.push(line);
          line = "";
        }
        line += character;
      }
      result.push(line);
    }
    return result;
  };
  const text = (value: unknown, x: number, size = 11, weight = false) =>
    page.drawText(clean(value), {
      x,
      y,
      size,
      font: weight ? bold : font,
      color: rgb(0.17, 0.2, 0.18),
      maxWidth: Math.min(485, 545 - x),
      lineHeight: 17,
    });
  text(company.name, 50, 24, true);
  y -= 34;
  for (const line of wrap(company.address, 310)) {
    text(line, 50);
    y -= 17;
  }
  y -= 15;
  text(company.email, 50);
  y -= 18;
  text(company.taxId, 50);
  y -= 55;
  text(
    entry.data.direction === "payable" ? "BILL SUMMARY" : "INVOICE",
    50,
    20,
    true,
  );
  text(entry.data.number, 360, 13, true);
  y -= 38;
  text(
    `${entry.data.direction === "payable" ? "Supplier" : "Bill to"}: ${entry.data.client}`,
    50,
    12,
    true,
  );
  y -= 20;
  text(entry.data.clientEmail, 50);
  y -= 32;
  text(`Issued: ${entry.data.issuedDate || entry.date}`, 50);
  text(`Due: ${entry.date}`, 360);
  y -= 42;
  text("Description", 50, 11, true);
  text("Qty", 350, 11, true);
  text("Amount", 430, 11, true);
  y -= 25;
  const lines = entry.data.lines as InvoiceLine[];
  for (const line of lines) {
    const description = wrap(line.description, 275);
    const rowHeight = Math.max(27, description.length * 17 + 10);
    if (y - rowHeight < 80) {
      page = pdf.addPage([595, 842]);
      y = 780;
    }
    const top = y;
    for (const part of description) {
      text(part, 50);
      y -= 17;
    }
    y = top;
    text(line.quantity, 350);
    text(money(invoiceLineAmount(line), company.currency), 430);
    y -= rowHeight;
  }
  if (y < 250) {
    page = pdf.addPage([595, 842]);
    y = 780;
  }
  const { subtotal, tax } = recordedInvoiceTotals(entry);
  y -= 20;
  text("Subtotal", 320);
  text(money(subtotal, company.currency), 430);
  y -= 24;
  text(`VAT (${entry.data.taxRate || 0}%)`, 320);
  text(money(tax, company.currency), 430);
  y -= 30;
  text("Total", 320, 13, true);
  text(money(entry.amount, company.currency), 430, 13, true);
  y -= 55;
  for (const value of [entry.data.notes, entry.data.paymentDetails]) {
    if (!value) continue;
    for (const line of wrap(value, 485, 10)) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 780;
      }
      text(line, 50, 10);
      y -= 17;
    }
    y -= 20;
  }
  pdf.setTitle(`Invoice ${entry.data.number}`);
  pdf.setAuthor(company.name);
  return pdf.save();
}
