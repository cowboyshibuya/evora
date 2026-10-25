import { calculateInvoiceTotals } from "../lib/invoices";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { env } from "cloudflare:workers";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { database } from "./db";
import { companies, entries, memberships } from "./schema";
import type { EntryInput } from "../lib/types";

const iso = (date: Date) => format(date, "yyyy-MM-dd");
export async function seedDemo(userId: string) {
  const db = database(),
    now = new Date(),
    timestamp = now.toISOString();
  for (const [index, name] of ["Studio North", "North Ventures"].entries()) {
    const companyId = crypto.randomUUID();
    await db.batch([
      db.insert(companies).values({
        id: companyId,
        name,
        industry: index ? "Consulting" : "Design & technology",
        currency: "EUR",
        country: "Belgium",
        email: index ? "hello@north.ventures" : "hello@studionorth.design",
        address: "Rue Antoine Dansaert 88\n1000 Brussels, Belgium",
        taxId: "BE 0789.456.123",
        fiscalMonth: 1,
        createdAt: timestamp,
      }),
      db
        .insert(memberships)
        .values({ id: crypto.randomUUID(), companyId, userId, role: "owner" }),
    ]);
    const records: EntryInput[] = [];
    const record = (
      kind: EntryInput["kind"],
      title: string,
      date: string,
      amount: number,
      category: string,
      status: string,
      data: Record<string, unknown> = {},
    ) => records.push({ kind, title, date, amount, category, status, data });
    const clients = [
      "Acme Studio",
      "Linear",
      "Vercel",
      "Layers",
      "Orbit Digital",
    ];
    for (let month = 5; month >= 0; month--) {
      const start = startOfMonth(addMonths(now, -month));
      clients.forEach((client, i) => {
        const d = addDays(start, i * 3 + 1);
        if (d <= now)
          record(
            "transaction",
            `${client} · ${i % 2 ? "Monthly retainer" : "Brand & product design"}`,
            iso(d),
            Math.round(
              (580000 + i * 125000 + (5 - month) * 42000) *
                [0.82, 1.1, 0.93, 1.18, 1.02, 1.16][5 - month] *
                (index ? 0.4 : 1),
            ),
            "Client work",
            "completed",
            { counterparty: client, method: "Bank transfer" },
          );
      });
      [
        ["Figma", "Software", 4500],
        ["Notion", "Software", 1800],
        ["Workspace rent", "Office", 180000],
        ["Team payroll", "Payroll", 1240000],
        ["Google Workspace", "Software", 3600],
        ["Accountant", "Professional services", 65000],
      ].forEach(([title, category, cents], i) => {
        const d = addDays(start, i * 2 + 2);
        if (d <= now)
          record(
            "transaction",
            String(title),
            iso(d),
            -Math.round(Number(cents) * (index ? 0.3 : 1)),
            String(category),
            "completed",
            { counterparty: title, method: "Bank transfer" },
          );
      });
    }
    const invoices: [string, string, number, number, string][] = [
      ["Acme Studio", "Brand identity & website", 480000, -5, "sent"],
      ["Orbit Digital", "Product design sprint", 325000, -2, "sent"],
      ["Linear", "October design retainer", 650000, 4, "sent"],
      ["Layers", "Website development", 820000, 9, "sent"],
      ["Vercel", "Design system consulting", 240000, 12, "draft"],
      ["Acme Studio", "Discovery workshop", 150000, -12, "paid"],
    ];
    invoices.forEach(([client, title, amount, offset, status], i) => {
      const subtotal = Math.round(amount * (index ? 0.5 : 1));
      const lines = [{ description: title, quantity: 1, unitPrice: subtotal }];
      record(
        "invoice",
        title,
        iso(addDays(now, offset)),
        calculateInvoiceTotals(lines, 21).total,
        "Services",
        status,
        {
          client,
          clientEmail: `accounts@${client.toLowerCase().replaceAll(" ", "")}.example`,
          number: `INV-${now.getFullYear()}-${String(24 + i).padStart(3, "0")}`,
          issuedDate: iso(addDays(now, -20 + i)),
          taxRate: 21,
          lines,
          notes: "Thank you for your trust. Payment is due within 30 days.",
          paymentDetails: "IBAN: BE68 5390 0754 7034",
        },
      );
    });
    [
      [
        "Submit quarterly VAT return",
        1,
        "Tax",
        "Review Q3 income, expenses and deductible VAT with your accountant.",
      ],
      [
        "Pay team salaries",
        6,
        "Payroll",
        "Prepare and approve the monthly payroll transfer.",
      ],
      [
        "Monthly bookkeeping review",
        10,
        "Accounting",
        "Reconcile transactions and collect outstanding receipts.",
      ],
      [
        "Prepare annual financial statements",
        28,
        "Annual balance",
        "Compile the balance sheet, profit and loss statement, and supporting documents.",
      ],
      [
        "Renew professional insurance",
        15,
        "Renewal",
        "Review coverage before the policy renews.",
      ],
    ].forEach(([title, offset, category, description]) =>
      record(
        "event",
        String(title),
        iso(addDays(now, Number(offset))),
        0,
        String(category),
        "pending",
        {
          description,
          recurrence:
            category === "Annual balance" || category === "Renewal"
              ? "yearly"
              : "none",
          time: "09:00",
        },
      ),
    );
    [
      [
        "Q4, a little more focused",
        "A few things to keep us moving in the right direction.\n\n• Wrap up the Acme brand launch\n• Make room for two new retainer clients\n• Keep Fridays for internal projects\n• Review our pricing before January",
        "Planning",
        true,
      ],
      [
        "A note for our accountant",
        "For our next bookkeeping review:\n\n1. Check the new equipment depreciation.\n2. Confirm the deductible portion of travel expenses.\n3. Prepare a cash reserve for the annual tax payment.",
        "Finance",
        true,
      ],
      [
        "Ideas worth keeping",
        "A shared resource library for clients.\nA small studio open day in November.\nDocument the design process as we go.",
        "Ideas",
        false,
      ],
      [
        "October team check-in",
        "The team is in a good rhythm. Let’s keep projects small and communication clear.\n\nNext check-in: first Monday of November.",
        "Team",
        false,
      ],
    ].forEach(([title, content, category, pinned]) =>
      record("note", String(title), iso(now), 0, String(category), "active", {
        content,
        pinned,
      }),
    );
    clients.forEach((client, i) =>
      record(
        "contact",
        client,
        iso(now),
        0,
        i % 2 ? "Partner" : "Client",
        "active",
        {
          email: `hello@${client.toLowerCase().replaceAll(" ", "")}.example`,
          person: [
            "Sarah Chen",
            "James Wilson",
            "Emma Davis",
            "Lucas Martin",
            "Sophie Laurent",
          ][i],
          phone: `+32 470 12 34 ${50 + i}`,
          address: "Brussels, Belgium",
        },
      ),
    );
    for (const [title, folder, description] of [
      [
        "Q3 financial summary.pdf",
        "Finance",
        "Quarterly income and expense summary for the company.",
      ],
      [
        "Studio service agreement.pdf",
        "Contracts",
        "Standard service agreement outlining the scope of work and payment terms.",
      ],
      [
        "Company registration.pdf",
        "Company",
        "Company registration reference and administrative details.",
      ],
    ] as const) {
      const id = crypto.randomUUID(),
        pdf = await PDFDocument.create(),
        page = pdf.addPage([595, 842]),
        font = await pdf.embedFont(StandardFonts.Helvetica);
      page.drawText(name, {
        x: 50,
        y: 770,
        size: 26,
        font,
        color: rgb(0.15, 0.25, 0.2),
      });
      page.drawText(title.replace(".pdf", ""), {
        x: 50,
        y: 710,
        size: 18,
        font,
      });
      page.drawText(description, {
        x: 50,
        y: 670,
        size: 11,
        font,
        maxWidth: 490,
        lineHeight: 18,
      });
      page.drawText("Sample document - Evora demo workspace", {
        x: 50,
        y: 80,
        size: 10,
        font,
      });
      const bytes = await pdf.save(),
        key = `${companyId}/${id}`;
      await env.FILES.put(key, bytes, {
        httpMetadata: { contentType: "application/pdf" },
      });
      record("document", title, iso(addDays(now, -3)), 0, folder, "active", {
        key,
        size: bytes.length,
        mime: "application/pdf",
        description,
      });
    }
    for (let offset = 0; offset < records.length; offset += 5) {
      await db.insert(entries).values(
        records.slice(offset, offset + 5).map((r) => ({
          ...r,
          id: crypto.randomUUID(),
          companyId,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
      );
    }
  }
}
