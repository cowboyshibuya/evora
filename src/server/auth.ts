import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { database } from "./db";
import * as schema from "./schema";

export function getAuth(request: Request) {
  if (
    !import.meta.env.DEV &&
    (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)
  )
    throw new Error(
      "BETTER_AUTH_SECRET must be at least 32 characters before deployment.",
    );
  const baseURL = import.meta.env.DEV
    ? new URL(request.url).origin
    : env.APP_URL;
  return betterAuth({
    appName: "Evora",
    baseURL,
    secret:
      env.BETTER_AUTH_SECRET ||
      "evora-local-development-secret-not-for-production-2026",
    database: drizzleAdapter(database(), { provider: "sqlite", schema }),
    emailAndPassword: { enabled: false },
    disabledPaths: [
      "/sign-up/email",
      "/sign-in/email",
      "/request-password-reset",
      "/reset-password",
      "/change-password",
      "/set-password",
      "/verify-password",
      "/send-verification-email",
      "/verify-email",
    ],
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account" as const,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
            },
          }
        : {}),
    },
    // Preserve verified-email linking protections; never trust an unverified
    // provider or a different email address to claim an existing account.
    account: { accountLinking: { enabled: true, allowDifferentEmails: false } },
    onAPIError: { errorURL: `${baseURL}/auth` },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: import.meta.env.DEV ? 10000 : 100,
      customRules: {
        "/sign-in/social": {
          window: 60,
          max: import.meta.env.DEV ? 10000 : 10,
        },
        "/sign-in/anonymous": {
          window: 60,
          max: import.meta.env.DEV ? 10000 : 5,
        },
      },
    },
    plugins: [anonymous({ generateName: () => "Alex Morgan" })],
  });
}
