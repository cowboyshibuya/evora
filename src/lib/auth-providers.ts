export const AUTH_PROVIDERS = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number]["id"];

export interface AuthProviderAvailability {
  providers: AuthProvider[];
}

export function authReturnPath(invite: string | null) {
  return invite ? `/?invite=${encodeURIComponent(invite)}` : "/";
}

export function authErrorMessage(code: string | null) {
  if (!code) return "";
  if (code === "access_denied")
    return "Sign-in was cancelled. Choose Google or GitHub to try again.";
  if (code === "email_not_found")
    return "Your provider did not share an email address. Allow email access or use your other provider.";
  if (code === "email_not_verified")
    return "Verify your email address with your sign-in provider, then try again.";
  if (
    code === "account_not_linked" ||
    code === "email_does_not_match" ||
    code === "unable_to_link_account"
  )
    return "Use the provider you originally signed in with. The accounts could not be linked.";
  return "Unable to finish signing in. Please try again.";
}
