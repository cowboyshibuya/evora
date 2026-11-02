import { test, expect } from "@playwright/test";

test("system theme, saved appearance, collapsed navigation and mobile navigation", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/settings");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("combobox", { name: "Theme", exact: true }).click();
  await page.getByRole("option", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "68px");
  await page.reload();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "68px");
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(page).toHaveURL(/transactions/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "224px");
  await expect(
    page.getByRole("link", { name: "Transactions", exact: true }),
  ).toBeVisible();
});

test("transactions save reusable company profiles, suggest by keyboard and preserve overrides", async ({
  page,
}) => {
  await page.goto("/transactions");
  await expect(page.locator("main h1")).toBeVisible();
  const company = `Vercel ${Date.now()}`;
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".dialog-heading .sr-only")).toHaveCSS(
    "position",
    "absolute",
  );
  await dialog.getByRole("button", { name: "Money out" }).click();
  await dialog.getByLabel("Title", { exact: true }).fill("Hosting invoice");
  await dialog.getByLabel(/^Amount/).fill("20");
  await dialog
    .getByRole("combobox", { name: "Client or supplier" })
    .fill(company);
  await dialog
    .getByRole("checkbox", { name: `Save ${company} as a company profile` })
    .check();
  await dialog
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  let workspace = await (await page.request.get("/api/workspace")).json();
  const profile = workspace.entries.find(
    (e: { title: string }) => e.title === company,
  );
  expect(profile.kind).toBe("contact");
  const record = workspace.entries.find(
    (e: { title: string }) => e.title === "Hosting invoice",
  );
  expect(record.data.profileId).toBe(profile.id);
  expect(profile.data.transactionCategory).toBe("Software");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Money out" }).click();
  const supplier = dialog.getByRole("combobox", { name: "Client or supplier" });
  await supplier.fill("V");
  await expect(
    dialog.getByRole("option", { name: `${company} Supplier` }),
  ).toBeVisible();
  await supplier.fill(company);
  await supplier.press("ArrowDown");
  await supplier.press("Enter");
  await expect(supplier).toHaveValue(company);
  await dialog.getByLabel("Title", { exact: true }).fill("Hosting renewal");
  await dialog.getByLabel(/^Amount/).fill("25");
  await dialog
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  workspace = await (await page.request.get("/api/workspace")).json();
  expect(
    workspace.entries.filter(
      (e: { kind: string; title: string }) =>
        e.kind === "contact" && e.title === company,
    ),
  ).toHaveLength(1);
  expect(
    workspace.entries.find(
      (e: { title: string }) => e.title === "Hosting renewal",
    ).data.profileId,
  ).toBe(profile.id);
  const response = await page.request.post("/api/entries", {
    data: {
      kind: "transaction",
      title: "Invalid profile",
      date: "2026-11-01",
      amount: -2000,
      category: "Software",
      status: "completed",
      data: { counterparty: company, profileId: "another-company-profile" },
    },
  });
  expect(response.status()).toBe(400);
});

test("invoice profiles carry through payments and reject links across companies", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  const workspace = await (await page.request.get("/api/workspace")).json();
  const title = `Profile client ${Date.now()}`;
  const input = {
    kind: "invoice",
    title: "Consulting",
    date: "2026-11-10",
    amount: 10000,
    category: "Services",
    status: "sent",
    data: {
      direction: "receivable",
      client: title,
      clientEmail: "hello@example.com",
      issuedDate: "2026-11-01",
      number: `TEST-${Date.now()}`,
      taxRate: 0,
      lines: [{ description: "Consulting", quantity: 1, unitPrice: 10000 }],
      saveProfile: true,
    },
  };
  const response = await page.request.post("/api/entries", { data: input });
  expect(response.ok(), await response.text()).toBe(true);
  const { id } = await response.json();
  let updated = await (await page.request.get("/api/workspace")).json();
  const profile = updated.entries.find(
    (e: { title: string }) => e.title === title,
  );
  expect(profile.data.email).toBe("hello@example.com");
  expect(profile.data.transactionCategory).toBe("Client work");
  expect((await page.request.post(`/api/entries/${id}/pay`)).ok()).toBe(true);
  updated = await (await page.request.get("/api/workspace")).json();
  const payment = updated.entries.find(
    (e: { id: string }) => e.id === `payment_${id}`,
  );
  expect(payment.data.profileId).toBe(profile.id);
  const otherCompany = workspace.companies.find(
    (c: { id: string }) => c.id !== workspace.company.id,
  );
  expect(otherCompany).toBeTruthy();
  const foreign = await page.request.post(
    `/api/entries?company=${otherCompany.id}`,
    {
      data: {
        kind: "transaction",
        title: "Foreign link",
        date: "2026-11-01",
        amount: 100,
        category: "Sales",
        status: "completed",
        data: { counterparty: title, profileId: profile.id },
      },
    },
  );
  expect(foreign.status()).toBe(400);
});
