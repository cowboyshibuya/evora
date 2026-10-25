/**
 * OAuth provider boundary used ONLY by tests/vite.config.ts.
 * The app's real Better Auth handlers still verify state, persist accounts,
 * issue cookies, and enforce sessions. Only the external provider response is
 * replaced. This module is never imported by the application build.
 */
import { betterAuth } from "better-auth/minimal";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { getAuth as getApplicationAuth } from "../src/server/auth";

const profileSchema = z.object({
  email: z.email(),
  name: z.string().default("Jamie Parker"),
  verified: z.boolean().default(true),
});

const mockProviderBoundary = {
  id: "evora-e2e-oauth-boundary",
  init(ctx) {
    for (const provider of ctx.socialProviders) {
      provider.validateAuthorizationCode = async ({ code }) => {
        const profile = profileSchema.safeParse(JSON.parse(code));
        return profile.success ? { accessToken: code } : null;
      };
      provider.getUserInfo = async (tokens) => {
        const profile = profileSchema.parse(JSON.parse(tokens.accessToken!));
        return {
          user: {
            email: profile.email,
            name: profile.name,
            emailVerified: profile.verified,
          },
          data: { id: profile.email, sub: profile.email },
        };
      };
    }
  },
} satisfies BetterAuthPlugin;

export function getAuth(request: Request) {
  const options = getApplicationAuth(request).options;
  return betterAuth({
    ...options,
    socialProviders: {
      google: { clientId: "e2e-google", clientSecret: "e2e-only" },
      github: { clientId: "e2e-github", clientSecret: "e2e-only" },
    },
    plugins: [...(options.plugins ?? []), mockProviderBoundary],
  });
}
