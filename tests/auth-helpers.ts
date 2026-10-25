import { expect, type BrowserContext } from "@playwright/test";
import type { AuthProvider } from "../src/lib/auth-providers";

export const TEST_ORIGIN = "http://localhost:3001";
export const uid = () => crypto.randomUUID().slice(0, 8);

export async function signIn(
  context: BrowserContext,
  email = `evora-${uid()}@example.com`,
  provider: AuthProvider = "google",
  verified = true,
) {
  const response = await context.request.post("/api/auth/sign-in/social", {
    headers: { Origin: TEST_ORIGIN },
    data: {
      provider,
      callbackURL: `${TEST_ORIGIN}/`,
      errorCallbackURL: `${TEST_ORIGIN}/auth`,
      disableRedirect: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const authorizationURL = new URL((await response.json()).url);
  const callback = new URL(`/api/auth/callback/${provider}`, TEST_ORIGIN);
  callback.searchParams.set(
    "state",
    authorizationURL.searchParams.get("state")!,
  );
  callback.searchParams.set("code", JSON.stringify({ email, verified }));
  const result = await context.request.get(callback.href, { maxRedirects: 0 });
  expect(result.status(), await result.text()).toBe(302);
  expect(result.headers().location).toBe(`${TEST_ORIGIN}/`);
  return {
    email,
    ...(await (await context.request.get("/api/auth/get-session")).json()),
  };
}
