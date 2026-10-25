import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

import { signIn, uid, TEST_ORIGIN } from "./auth-helpers";

async function createCompany(context: BrowserContext, name = "Test Company") {
  const response = await context.request.post("/api/companies", {
    data: { name, currency: "EUR", country: "Belgium" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).id as string;
}

test("demo: persistent bookkeeping, company switching, notes and original documents", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const title = `Test client payment ${uid()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Amount (EUR)", { exact: true }).fill("123.45");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("table").getByText(title)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("table").getByText(title)).toBeVisible();
  await page.getByRole("button", { name: "Switch company" }).click();
  await page.getByRole("menuitem", { name: "North Ventures" }).click();
  await expect(
    page.getByRole("button", { name: "Switch company" }),
  ).toContainText("North Ventures");
  await expect(page.getByRole("table").getByText(title)).toHaveCount(0);
  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Write a note", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("A note that stays");
  await page
    .getByLabel("Note content")
    .fill("Written once, safely kept across reloads.");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A note that stays" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A note that stays" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await page.getByLabel("Upload company documents").setInputFiles({
    name: "original-test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Original document bytes, preserved."),
  });
  await expect(
    page.getByText("original-test.txt", { exact: true }).first(),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download original-test.txt", exact: true })
    .last()
    .click();
  const download = await downloadEvent;
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "Original document bytes, preserved.",
  );
});

test("OAuth signup, onboarding, invoices, payment idempotency, exports and company isolation", async ({
  page,
  browser,
}) => {
  await signIn(page.context(), `owner-${uid()}@example.com`);
  await page.goto("/");
  await expect(page.getByRole("dialog")).toContainText(
    "A home for your company",
  );
  await page.getByLabel("Company name", { exact: true }).fill("Parker Studio");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch company" }),
  ).toContainText("Parker Studio");
  const workspace = await (await page.request.get("/api/workspace")).json(),
    companyId = workspace.company.id;
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page
    .getByRole("button", { name: "Create invoice", exact: true })
    .first()
    .click();
  await page.getByLabel("Invoice description").fill("Product design");
  await page.getByLabel("Client name", { exact: true }).fill("Example Client");
  await page.getByLabel("Client email").fill("accounts@example.com");
  await page.getByLabel("Line 1 description").fill("Design services");
  await page.getByLabel("Line 1 quantity").fill("2");
  await page.getByLabel("Line 1 unit price").fill("150");
  await expect(page.getByRole("dialog")).toContainText("€363.00");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: /INV-.*Product design/ }).click();
  await page.getByRole("button", { name: "Mark as sent", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: /INV-.*Product design/ }).click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const paidWorkspace = await (await page.request.get("/api/workspace")).json();
  const invoice = paidWorkspace.entries.find(
    (e: { kind: string }) => e.kind === "invoice",
  );
  expect(invoice.amount).toBe(36300);
  expect(invoice.status).toBe("paid");
  await Promise.all([
    page.request.post(`/api/entries/${invoice.id}/pay?company=${companyId}`),
    page.request.post(`/api/entries/${invoice.id}/pay?company=${companyId}`),
  ]);
  const payments = (
    await (await page.request.get("/api/workspace")).json()
  ).entries.filter(
    (e: { data: { invoiceId?: string } }) => e.data.invoiceId === invoice.id,
  );
  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(36300);
  const locked = await page.request.delete(
    `/api/entries/${invoice.id}?company=${companyId}`,
  );
  expect(locked.status()).toBe(400);
  const currencyChange = await page.request.put(
    `/api/company?company=${companyId}`,
    { data: { ...paidWorkspace.company, currency: "USD" } },
  );
  expect(currencyChange.status()).toBe(400);
  await page.getByRole("button", { name: /INV-.*Product design/ }).click();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const pdf = await pdfDownload;
  expect((await readFile((await pdf.path())!)).subarray(0, 4).toString()).toBe(
    "%PDF",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const xlsxEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  const xlsx = await xlsxEvent;
  expect((await readFile((await xlsx.path())!)).subarray(0, 2).toString()).toBe(
    "PK",
  );
  const outsider = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  await signIn(outsider);
  expect(
    (
      await outsider.request.get(`/api/workspace?company=${companyId}`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await outsider.request.post(`/api/entries?company=${companyId}`, {
        data: { kind: "note", title: "Intrusion", date: "2026-10-19" },
      })
    ).status(),
  ).toBe(403);
  await outsider.close();
  const company2 = await createCompany(page.context(), "Parker Ventures");
  await page.reload();
  await page.getByRole("button", { name: "Switch company" }).click();
  await page.getByRole("menuitem", { name: "Parker Ventures" }).click();
  await expect(page.getByRole("table").getByText("Product design")).toHaveCount(
    0,
  );
  expect(
    (
      await (
        await page.request.get(`/api/workspace?company=${company2}`)
      ).json()
    ).entries,
  ).toHaveLength(0);
});

test("shareable invitations enforce verified email and viewer access; sessions can be revoked", async ({
  browser,
}) => {
  const owner = await browser.newContext({
      baseURL: TEST_ORIGIN,
      extraHTTPHeaders: { Origin: TEST_ORIGIN },
    }),
    viewer = await browser.newContext({
      baseURL: TEST_ORIGIN,
      extraHTTPHeaders: { Origin: TEST_ORIGIN },
    });
  await signIn(owner);
  const viewerIdentity = await signIn(viewer, undefined, "github"),
    companyId = await createCompany(owner, "Team Workspace");
  const invitation = await owner.request.post(
    `/api/invitations?company=${companyId}`,
    { data: { email: viewerIdentity.email, role: "viewer" } },
  );
  expect(invitation.status(), await invitation.text()).toBe(201);
  const token = new URL((await invitation.json()).url).searchParams.get(
    "invite",
  );
  expect(
    (
      await owner.request.post("/api/invitations/accept", { data: { token } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await viewer.request.post("/api/invitations/accept", { data: { token } })
    ).ok(),
  ).toBeTruthy();
  const read = await viewer.request.get(`/api/workspace?company=${companyId}`);
  expect(read.ok()).toBeTruthy();
  expect((await read.json()).company.role).toBe("viewer");
  expect(
    (
      await viewer.request.post(`/api/entries?company=${companyId}`, {
        data: { kind: "note", title: "Cannot write", date: "2026-10-19" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await viewer.request.put(`/api/company?company=${companyId}`, {
        data: { name: "Cannot rename" },
      })
    ).status(),
  ).toBe(403);
  const recurring = await owner.request.post(
    `/api/entries?company=${companyId}`,
    {
      data: {
        kind: "event",
        title: "Annual financial review",
        date: "2026-10-19",
        status: "pending",
        data: { recurrence: "yearly" },
      },
    },
  );
  const eventId = (await recurring.json()).id,
    before = (
      await (
        await owner.request.get(`/api/workspace?company=${companyId}`)
      ).json()
    ).entries[0];
  expect(
    (
      await owner.request.put(`/api/entries/${eventId}?company=${companyId}`, {
        data: { ...before, status: "done" },
      })
    ).ok(),
  ).toBeTruthy();
  const after = (
    await (
      await owner.request.get(`/api/workspace?company=${companyId}`)
    ).json()
  ).entries;
  expect(
    after.find((e: { status: string }) => e.status === "pending").date,
  ).toBe("2027-10-19");
  // A second provider with the same verified email reaches the same account.
  const sameUser = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  const secondLogin = await signIn(sameUser, viewerIdentity.email, "google");
  expect(secondLogin.user.id).toBe(viewerIdentity.user.id);
  expect(
    (await sameUser.request.get(`/api/workspace?company=${companyId}`)).ok(),
  ).toBeTruthy();
  const revoke = await sameUser.request.post("/api/auth/revoke-session", {
    data: { token: viewerIdentity.session.token },
  });
  expect(revoke.ok(), await revoke.text()).toBeTruthy();
  expect((await viewer.request.get("/api/workspace")).status()).toBe(401);
  expect((await sameUser.request.get("/api/workspace")).ok()).toBeTruthy();
  await sameUser.close();
  await owner.close();
  await viewer.close();
});

test("desktop and mobile layouts, keyboard search, and accessible controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("dialog", { name: "Find a little clarity" }),
  ).toBeVisible();
  await page.getByLabel("Search all company records").fill("quarterly");
  await expect(
    page.getByRole("button", { name: /Submit quarterly VAT return/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  for (const route of [
    "/transactions",
    "/invoices",
    "/calendar",
    "/documents",
    "/notes",
    "/contacts",
    "/reports",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    const errors = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      errors.violations.map((v) => ({
        route,
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.locator("main h1")).toContainText("Room to plan ahead");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/calendar-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of [
    "/",
    "/transactions",
    "/invoices",
    "/calendar",
    "/documents",
    "/notes",
    "/contacts",
    "/reports",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `320px reflow on ${route}`,
    ).toBeTruthy();
  }
  await page.goto("/auth");
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  const authResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    authResults.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});

test("CSV import, duplicate protection, supplier payments and a complete portable archive", async ({
  page,
}) => {
  await signIn(page.context());
  const companyId = await createCompany(
    page.context(),
    "Import & Bills Studio",
  );
  await page.goto("/transactions");
  await expect(page.locator("main h1")).toBeVisible();
  const file = {
    name: "bank-records.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Description,Date,Amount,Category\nClient milestone,2026-10-19,1250.50,Client work\nSoftware renewal,2026-10-19,-49.20,Software\n",
    ),
  };
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.getByLabel("Import CSV file").setInputFiles(file);
  await expect(page.getByRole("dialog")).toContainText("2 transactions ready");
  await page
    .getByRole("button", { name: "Import 2 transactions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.getByLabel("Import CSV file").setInputFiles(file);
  await page
    .getByRole("button", { name: "Import 2 transactions", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("already been imported");
  await page.getByRole("button", { name: "Close dialog" }).click();
  let workspace = await (await page.request.get("/api/workspace")).json();
  expect(workspace.entries).toHaveLength(2);
  expect(
    workspace.entries.map((e: { amount: number }) => e.amount).sort(),
  ).toEqual([-4920, 125050].sort());
  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("combobox", { name: "Invoice direction" }).click();
  await page
    .getByRole("option", { name: "Supplier bills", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add supplier bill", exact: true })
    .click();
  await page.getByLabel("Invoice description").fill("Annual software plan");
  await page.getByLabel("Supplier name", { exact: true }).fill("Tools Company");
  await page
    .getByLabel("Supplier email", { exact: true })
    .fill("billing@tools.example");
  await page.getByLabel("Line 1 description").fill("Software licence");
  await page.getByLabel("Line 1 unit price").fill("100");
  await page.getByRole("combobox", { name: "Bill expense category" }).click();
  await page.getByRole("option", { name: "Software", exact: true }).click();
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: /INV-.*Annual software plan/ })
    .click();
  await page
    .getByRole("button", { name: "Mark as received", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: /INV-.*Annual software plan/ })
    .click();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  workspace = await (await page.request.get("/api/workspace")).json();
  const payment = workspace.entries.find(
    (e: { data: { invoiceId?: string } }) => e.data.invoiceId,
  );
  expect(payment.amount).toBe(-12100);
  expect(payment.category).toBe("Software");
  await page.request.post(`/api/entries?company=${companyId}`, {
    data: {
      kind: "note",
      title: "Portable note",
      date: "2026-10-19",
      data: { content: "A note that travels with you." },
    },
  });
  const upload = await page.request.post(`/api/upload?company=${companyId}`, {
    multipart: {
      file: {
        name: "original.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("The original source document."),
      },
      folder: "Company",
    },
  });
  expect(upload.status()).toBe(201);
  // The fixtures above use the API directly; refresh the browser's query cache.
  await page.reload();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Data & exports" }).click();
  await page.getByRole("button", { name: "Export company data" }).click();
  await page
    .getByRole("button", { name: "Complete archive Records, PDFs & files" })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  const archive = await event;
  const zip = await JSZip.loadAsync(await readFile((await archive.path())!)),
    paths = Object.keys(zip.files);
  expect(paths).toContain("records.json");
  expect(paths).toContain("calendar.ics");
  expect(
    await zip
      .file(paths.find((p) => p.endsWith("original.txt"))!)!
      .async("string"),
  ).toBe("The original source document.");
  expect(
    await zip
      .file(paths.find((p) => p.startsWith("notes/") && p.endsWith(".md"))!)!
      .async("string"),
  ).toContain("A note that travels with you.");
  expect(
    paths.some((p) => p.startsWith("invoices/") && p.endsWith(".pdf")),
  ).toBeTruthy();
});
