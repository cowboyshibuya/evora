import { test, expect, type Page } from "@playwright/test";
import { addDays, format, startOfMonth } from "date-fns";
import AxeBuilder from "@axe-core/playwright";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { signIn, TEST_ORIGIN, uid } from "./auth-helpers";

async function imageFile(page: Page, color = "#277455") {
  const base64 = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  }, color);
  return {
    name: "company-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

async function openDemo(page: Page, route = "/") {
  await page.goto(route);
  await expect(page.locator("main h1")).toBeVisible();
}

async function sequence(page: Page, key: string) {
  await page.keyboard.press("n");
  await page.keyboard.press(key);
}

const selectedDay = addDays(startOfMonth(new Date()), 14);
const selectedDate = format(selectedDay, "yyyy-MM-dd");
const dayLabel = `Add to ${format(selectedDay, "EEEE dd MMMM yyyy")}`;

test("company logos persist from onboarding, replace, export, switch and remove", async ({
  page,
}) => {
  await signIn(page.context());
  await page.goto("/");
  await page.getByLabel("Company name", { exact: true }).fill("Logo Studio");
  const original = await imageFile(page);
  await page
    .getByLabel("Upload company logo", { exact: true })
    .setInputFiles(original);
  await expect(
    page.getByRole("img", { name: "Logo Studio logo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".company-switcher img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".company-switcher img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(32);
  const company = (await (await page.request.get("/api/workspace")).json())
    .company;
  expect(company.logoKey).toContain(`${company.id}/logos/`);
  expect(
    Buffer.from(
      await (
        await page.request.get(`/api/company/logo?company=${company.id}`)
      ).body(),
    ),
  ).toEqual(original.buffer);
  await page.reload();
  await expect(page.locator(".company-switcher img")).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const replacement = await imageFile(page, "#405080");
  await page
    .getByLabel("Upload company logo", { exact: true })
    .setInputFiles(replacement);
  await page
    .getByRole("button", { name: "Save company details", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/workspace")).json()).company
          .logoKey,
    )
    .not.toBe(company.logoKey);
  expect(
    Buffer.from(
      await (
        await page.request.get(`/api/company/logo?company=${company.id}`)
      ).body(),
    ),
  ).toEqual(replacement.buffer);
  await page.getByRole("tab", { name: "Data & exports" }).click();
  await page.getByRole("button", { name: "Export company data" }).click();
  await page
    .getByRole("button", { name: "Complete archive Records, PDFs & files" })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export data", exact: true }).click();
  const download = await downloadEvent;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(await zip.file("company-logo.png")!.async("nodebuffer")).toEqual(
    replacement.buffer,
  );
  const other = await page.request.post("/api/companies", {
    headers: { Origin: TEST_ORIGIN },
    data: { name: "Without Logo", country: "Belgium", currency: "EUR" },
  });
  expect(other.ok()).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Switch company" }).click();
  await page
    .getByRole("menuitem", { name: "Without Logo", exact: true })
    .click();
  await expect(page.locator(".company-switcher img")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch company" }).click();
  await page
    .getByRole("menuitem", { name: "Logo Studio", exact: true })
    .click();
  await expect(page.locator(".company-switcher img")).toBeVisible();
  await page.getByRole("button", { name: "Remove logo", exact: true }).click();
  await page
    .getByRole("button", { name: "Save company details", exact: true })
    .click();
  await expect(page.locator(".company-switcher img")).toHaveCount(0);
  expect(
    (
      await page.request.get(`/api/company/logo?company=${company.id}`)
    ).status(),
  ).toBe(404);
});

test("logo uploads validate images and enforce company membership and admin permissions", async ({
  page,
  browser,
}) => {
  const owner = page.context();
  await signIn(owner);
  const logo = await imageFile(page);
  const created = await owner.request.post("/api/companies", {
    headers: { Origin: TEST_ORIGIN },
    multipart: {
      company: JSON.stringify({
        name: "Protected Logo",
        country: "Belgium",
        currency: "EUR",
      }),
      logo,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const companyId = (await created.json()).id;
  const company = (
    await (
      await owner.request.get(`/api/workspace?company=${companyId}`)
    ).json()
  ).company;
  const outsider = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  const outsiderIdentity = await signIn(outsider);
  expect(
    (
      await outsider.request.get(`/api/company/logo?company=${companyId}`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await outsider.request.put(`/api/company?company=${companyId}`, {
        multipart: { company: JSON.stringify(company), logo },
      })
    ).status(),
  ).toBe(403);
  const invitation = await owner.request.post(
    `/api/invitations?company=${companyId}`,
    {
      headers: { Origin: TEST_ORIGIN },
      data: { email: outsiderIdentity.email, role: "viewer" },
    },
  );
  const token = new URL((await invitation.json()).url).searchParams.get(
    "invite",
  );
  expect(
    (
      await outsider.request.post("/api/invitations/accept", {
        data: { token },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await outsider.request.get(`/api/company/logo?company=${companyId}`)
    ).status(),
  ).toBe(200);
  expect(
    (
      await outsider.request.put(`/api/company?company=${companyId}`, {
        multipart: { company: JSON.stringify(company), removeLogo: "true" },
      })
    ).status(),
  ).toBe(403);
  for (const bad of [
    {
      file: {
        name: "logo.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      },
      status: 400,
    },
    {
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("This is not an image"),
      },
      status: 400,
    },
    {
      file: {
        name: "empty.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(0),
      },
      status: 400,
    },
    {
      file: {
        name: "large.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
      },
      status: 413,
    },
  ]) {
    const result = await owner.request.put(
      `/api/company?company=${companyId}`,
      {
        headers: { Origin: TEST_ORIGIN },
        multipart: { company: JSON.stringify(company), logo: bad.file },
      },
    );
    expect(result.status(), await result.text()).toBe(bad.status);
  }
  const after = (
    await (
      await owner.request.get(`/api/workspace?company=${companyId}`)
    ).json()
  ).company;
  expect(after.logoKey).toBe(company.logoKey);
  await outsider.close();
});

test("quick-add hotkeys open all editors, upload documents, and pause while typing or in a menu", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  for (const [label, key] of [
    ["Create invoice", "I"],
    ["Add transaction", "T"],
    ["Add reminder", "R"],
    ["Write a note", "N"],
    ["Add contact", "C"],
    ["Upload document", "D"],
  ]) {
    await expect(
      page.getByRole("menuitem", { name: new RegExp(label) }),
    ).toContainText(`N then ${key}`);
  }
  await sequence(page, "n");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("Escape");
  for (const [key, title] of [
    ["i", "New invoice"],
    ["t", "New transaction"],
    ["r", "New reminder"],
    ["n", "New note"],
    ["c", "New contact"],
  ]) {
    await sequence(page, key);
    await expect(
      page.getByRole("dialog", { name: title, exact: true }),
    ).toBeVisible();
    const field = page
      .getByRole("dialog")
      .locator('input:not([type="hidden"])')
      .first();
    await field.fill("");
    await field.focus();
    await sequence(page, "n");
    await expect(field).toHaveValue("nn");
    await expect(
      page.getByRole("dialog", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await page.keyboard.press("n");
  await page.waitForTimeout(1300); // Verifies the documented sequence timeout.
  await page.keyboard.press("i");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/notes");
  const search = page.getByLabel("Search notes", { exact: true });
  await search.focus();
  await sequence(page, "i");
  await expect(search).toHaveValue("ni");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator("main h1").click();
  const chooserEvent = page.waitForEvent("filechooser");
  await sequence(page, "d");
  const chooser = await chooserEvent;
  const name = `hotkey-${uid()}.txt`;
  await chooser.setFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("Uploaded with N then D"),
  });
  await expect
    .poll(async () =>
      (await (await page.request.get("/api/workspace")).json()).entries.some(
        (entry: { title: string }) => entry.title === name,
      ),
    )
    .toBeTruthy();
});

test("calendar day quick-add carries dates, preserves event clicks and works on mobile", async ({
  page,
}) => {
  await openDemo(page, "/calendar");
  const day = page.getByRole("button", { name: dayLabel, exact: true });
  await day.hover();
  await expect(day.locator(".calendar-day-plus")).toHaveCSS("opacity", "1");
  await day.click({ position: { x: 8, y: 8 } });
  await page.getByRole("menuitem", { name: /Create invoice/ }).click();
  await expect(page.getByLabel("Due date", { exact: true })).toHaveValue(
    selectedDate,
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await day.locator(".calendar-day-plus").click();
  await page.getByRole("menuitem", { name: /Add reminder/ }).click();
  await expect(page.getByLabel("Due date", { exact: true })).toHaveValue(
    selectedDate,
  );
  const title = `Calendar reminder ${uid()}`;
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Add reminder", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".calendar-event").filter({ hasText: title }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit reminder", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("menu")).not.toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await day.locator(".calendar-day-plus").click();
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: /Upload document/ }).click();
  const name = `calendar-upload-${uid()}.txt`;
  await (
    await chooserEvent
  ).setFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("Dated upload"),
  });
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/workspace")).json()).entries.find(
          (entry: { title: string }) => entry.title === name,
        )?.date,
    )
    .toBe(selectedDate);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await day.locator(".calendar-day-plus").click();
  await expect(page.getByRole("menu")).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/calendar-quick-add-mobile.png",
    fullPage: true,
  });
});

test("headers have only titles, breadcrumb returns to overview, and footers keep only the wordmark", async ({
  page,
}) => {
  await openDemo(page);
  await expect(page.locator(".overview-footnote")).toHaveText("evora.");
  await expect(
    page.locator(".overview-footnote .brand-monochrome"),
  ).toBeVisible();
  await expect(page.locator(".open-source-badge")).toHaveCount(0);
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
    await expect(
      page.locator(".page-heading p, .page-heading .eyebrow, .panel-heading p"),
    ).toHaveCount(0);
  }
  const company = (await (await page.request.get("/api/workspace")).json())
    .company;
  await page.getByRole("link", { name: company.name, exact: true }).click();
  await expect(page).toHaveURL(`${TEST_ORIGIN}/`);
  await expect(
    page.getByRole("heading", {
      name: /Good (morning|afternoon|evening), Alex/,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-simplified.png",
    fullPage: true,
  });
});

test("viewers cannot use creation shortcuts or logo controls", async ({
  page,
  browser,
}) => {
  const owner = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  await signIn(owner);
  const viewer = await signIn(page.context());
  const created = await owner.request.post("/api/companies", {
    data: { name: "Read-only Company", currency: "EUR", country: "Belgium" },
  });
  const companyId = (await created.json()).id;
  const invitation = await owner.request.post(
    `/api/invitations?company=${companyId}`,
    { data: { email: viewer.email, role: "viewer" } },
  );
  const token = new URL((await invitation.json()).url).searchParams.get(
    "invite",
  );
  expect(
    (
      await page.request.post("/api/invitations/accept", {
        headers: { Origin: TEST_ORIGIN },
        data: { token },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/calendar");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Quick add", exact: true }),
  ).toBeDisabled();
  await sequence(page, "i");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".calendar-day-plus")).toHaveCount(0);
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Upload logo", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Upload company logo", { exact: true }),
  ).toBeDisabled();
  await owner.close();
});

test("calendar add controls remain available on touch screens", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: TEST_ORIGIN,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await openDemo(page, "/calendar");
  const add = page.getByRole("button", { name: dayLabel, exact: true });
  await expect(add.locator(".calendar-day-plus")).toHaveCSS("opacity", "1");
  await add.locator(".calendar-day-plus").tap();
  await page.getByRole("menuitem", { name: /Add transaction/ }).tap();
  await expect(
    page.getByRole("dialog", { name: "New transaction", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Transaction date", { exact: true }),
  ).toHaveValue(selectedDate);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await context.close();
});
