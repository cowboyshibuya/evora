import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { signIn, TEST_ORIGIN, uid } from "./auth-helpers";
import { AUTH_PROVIDERS, type AuthProvider } from "../src/lib/auth-providers";

async function mockProviderConsent(
  page: Page,
  provider: AuthProvider,
  email: string,
) {
  const authorizationURLs: URL[] = [];
  await page.route(
    provider === "google"
      ? "https://accounts.google.com/o/oauth2/v2/auth?**"
      : "https://github.com/login/oauth/authorize?**",
    async (route) => {
      const url = new URL(route.request().url());
      authorizationURLs.push(url);
      const callback = new URL(`/api/auth/callback/${provider}`, TEST_ORIGIN);
      callback.searchParams.set("state", url.searchParams.get("state")!);
      callback.searchParams.set("code", JSON.stringify({ email }));
      await route.fulfill({
        status: 302,
        headers: { location: callback.href },
        body: "",
      });
    },
  );
  return authorizationURLs;
}

async function createTeam(context: BrowserContext) {
  await signIn(context);
  const response = await context.request.post("/api/companies", {
    headers: { Origin: TEST_ORIGIN },
    data: { name: "OAuth Team", currency: "EUR", country: "Belgium" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).id as string;
}

for (const { id, name } of AUTH_PROVIDERS) {
  test(`${name} button completes OAuth signup and preserves the session`, async ({
    page,
  }) => {
    const email = `browser-${id}-${uid()}@example.com`;
    const urls = await mockProviderConsent(page, id, email);
    // Start in the isolated demo to exercise anonymous-to-OAuth sign-in too.
    await page.goto("/");
    await expect(page.locator("main h1")).toBeVisible();
    await page.goto("/auth?mode=signup");
    await expect(
      page.getByRole("button", { name: `Continue with ${name}` }),
    ).toBeEnabled();
    if (id === "google") {
      await page.getByRole("link", { name: "Evora home" }).focus();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeFocused();
      await page.screenshot({
        path: "test-results/auth-social-desktop.png",
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: `Continue with ${name}` }).click();
    await expect(
      page.getByRole("dialog", { name: "A home for your company" }),
    ).toBeVisible();
    expect(urls).toHaveLength(1);
    expect(urls[0].searchParams.get("redirect_uri")).toBe(
      `${TEST_ORIGIN}/api/auth/callback/${id}`,
    );
    expect(urls[0].searchParams.get("state")).toBeTruthy();
    expect(urls[0].searchParams.get("code_challenge")).toBeTruthy();
    const scope = urls[0].searchParams.get("scope")!;
    expect(scope).toContain(id === "github" ? "user:email" : "email");
    const before = await (await page.request.get("/api/workspace")).json();
    expect(before.user.email).toBe(email);
    expect(before.user.isAnonymous).toBeFalsy();
    expect(before.companies).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "A home for your company" }),
    ).toBeVisible();
    const after = await (await page.request.get("/api/workspace")).json();
    expect(after.user.id).toBe(before.user.id);
    expect(
      await page.evaluate(() => localStorage.getItem("evora:signed-in")),
    ).toBe("1");
  });
}

test("admins share invitation links; OAuth returns recipients to the invited company", async ({
  page,
  browser,
}) => {
  const companyId = await createTeam(page.context());
  const email = `invite-browser-${uid()}@example.com`;
  await page.goto("/settings");
  await page.getByRole("tab", { name: "Team & access" }).click();
  await page.getByRole("button", { name: "Invite someone" }).click();
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByRole("combobox", { name: "Invitation role" }).click();
  await page
    .getByRole("option", { name: "Viewer · view and export records" })
    .click();
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const link = await page
    .getByLabel("Invitation link", { exact: true })
    .inputValue();
  expect(link).toContain("?invite=");
  await expect(page.getByRole("dialog")).toContainText(
    "Share this link with your teammate.",
  );
  const recipient = await browser.newContext({ baseURL: TEST_ORIGIN });
  const recipientPage = await recipient.newPage();
  await mockProviderConsent(recipientPage, "github", email);
  await recipientPage.goto(link);
  await expect(recipientPage).toHaveURL(/\/auth\?invite=/);
  await expect(
    recipientPage.getByText(/You’ve been invited to a company/),
  ).toBeVisible();
  await recipientPage
    .getByRole("button", { name: "Continue with GitHub" })
    .click();
  await expect(
    recipientPage.getByRole("button", { name: "Switch company" }),
  ).toContainText("OAuth Team");
  await expect(recipientPage).not.toHaveURL(/invite=/);
  const workspace = await (
    await recipientPage.request.get("/api/workspace")
  ).json();
  expect(workspace.company.id).toBe(companyId);
  expect(workspace.company.role).toBe("viewer");
  await expect(recipientPage.getByRole("dialog")).not.toBeVisible();
  const token = new URL(link).searchParams.get("invite");
  expect(
    (
      await recipient.request.post("/api/invitations/accept", {
        headers: { Origin: TEST_ORIGIN },
        data: { token },
      })
    ).status(),
  ).toBe(400);
  await recipient.close();
});

test("invitation acceptance rejects unverified provider email even in development", async ({
  browser,
}) => {
  const owner = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  const recipient = await browser.newContext({
    baseURL: TEST_ORIGIN,
    extraHTTPHeaders: { Origin: TEST_ORIGIN },
  });
  const companyId = await createTeam(owner);
  const email = `unverified-${uid()}@example.com`;
  await signIn(recipient, email, "github", false);
  const result = await owner.request.post(
    `/api/invitations?company=${companyId}`,
    { data: { email, role: "admin" } },
  );
  const token = new URL((await result.json()).url).searchParams.get("invite");
  expect(
    (
      await recipient.request.post("/api/invitations/accept", {
        data: { token },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await recipient.request.get(`/api/workspace?company=${companyId}`)
    ).status(),
  ).toBe(403);
  await owner.close();
  await recipient.close();
});

test("OAuth rejects forged state and external callback origins; cancellation preserves invitations", async ({
  page,
}) => {
  const unsafe = await page.request.post("/api/auth/sign-in/social", {
    headers: { Origin: TEST_ORIGIN },
    data: {
      provider: "google",
      callbackURL: "https://untrusted.example/",
      disableRedirect: true,
    },
  });
  expect(unsafe.status()).toBe(403);
  const forged = await page.request.get(
    "/api/auth/callback/github?state=forged&code=forged",
    { maxRedirects: 0 },
  );
  expect(forged.status()).toBe(302);
  expect(new URL(forged.headers().location).pathname).toBe("/auth");
  expect(
    await (await page.request.get("/api/auth/get-session")).json(),
  ).toBeNull();
  const invite = "sample-invitation-token";
  const response = await page.request.post("/api/auth/sign-in/social", {
    headers: { Origin: TEST_ORIGIN },
    data: {
      provider: "github",
      callbackURL: `${TEST_ORIGIN}/?invite=${invite}`,
      errorCallbackURL: `${TEST_ORIGIN}/auth?invite=${invite}`,
      disableRedirect: true,
    },
  });
  const url = new URL((await response.json()).url);
  await page.goto(
    `/api/auth/callback/github?state=${url.searchParams.get("state")}&error=access_denied&error_description=UNTRUSTED_PROVIDER_TEXT`,
  );
  await expect(page).toHaveURL(new RegExp(`invite=${invite}`));
  await expect(page.getByRole("alert")).toContainText("Sign-in was cancelled.");
  await expect(page.getByText("UNTRUSTED_PROVIDER_TEXT")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeEnabled();
});

test("password and development-mail routes are unavailable; only provider IDs are public", async ({
  request,
}) => {
  const availability = await request.get("/api/auth-providers");
  expect(await availability.json()).toEqual({
    providers: ["google", "github"],
  });
  expect(availability.headers()["cache-control"]).toBe("no-store");
  for (const path of [
    "sign-up/email",
    "sign-in/email",
    "request-password-reset",
    "reset-password",
    "change-password",
    "set-password",
    "verify-password",
    "send-verification-email",
  ]) {
    const response = await request.post(`/api/auth/${path}`, {
      headers: { Origin: TEST_ORIGIN },
      data: {
        email: "disabled@example.com",
        password: "unused-password",
        name: "Disabled",
        token: "unused-token",
      },
    });
    expect(response.status(), path).toBe(404);
  }
  expect(
    (
      await request.get(
        "/api/auth/reset-password/legacy-token?callbackURL=/auth",
        { maxRedirects: 0 },
      )
    ).status(),
  ).toBe(404);
  expect(
    (await request.get("/api/dev-mail?email=disabled@example.com")).status(),
  ).toBe(401);
});

test("unavailable providers and failed availability requests have accessible recovery", async ({
  page,
}) => {
  await page.route("**/api/auth-providers", (route) =>
    route.fulfill({ json: { providers: [] } }),
  );
  await page.goto("/auth");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Sign-in isn’t available yet.",
  );
  await page.unroute("**/api/auth-providers");
  let calls = 0;
  await page.route("**/api/auth-providers", (route) =>
    calls++ === 0
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { providers: ["google"] } }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeDisabled();
});
