import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import {
  AUTH_PROVIDERS,
  authErrorMessage,
  authReturnPath,
  type AuthProvider,
  type AuthProviderAvailability,
} from "@/lib/auth-providers";
import { Button } from "./ui/button";
import { Logo } from "./common";

function ProviderIcon({ provider }: { provider: AuthProvider }) {
  if (provider === "github")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.4 4.8 18.4 5 18.4 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.5c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.89.6-2.03.96-3.39.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.91A6 6 0 0 1 6.09 12c0-.66.11-1.31.31-1.91V7.5H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.5l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}

export function AuthPage() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const invite = params.get("invite");
  const [pending, setPending] = useState<AuthProvider | null>(null);
  const [error, setError] = useState(() =>
    authErrorMessage(params.get("error")),
  );
  const availability = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api<AuthProviderAvailability>("auth-providers"),
    retry: false,
  });
  const signIn = async (provider: AuthProvider) => {
    setError("");
    setPending(provider);
    try {
      const callbackURL = `${window.location.origin}${authReturnPath(invite)}`;
      const errorURL = new URL("/auth", window.location.origin);
      if (invite) errorURL.searchParams.set("invite", invite);
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL: errorURL.href,
        disableRedirect: true,
      });
      if (result.error || !result.data?.url)
        throw new Error("Unable to start sign-in. Please try again.");
      localStorage.removeItem("evora:company");
      window.location.assign(result.data.url);
    } catch {
      setError("Unable to start sign-in. Please try again.");
      setPending(null);
    }
  };
  return (
    <div className="auth-layout">
      <main className="auth-main">
        <a href="/" className="auth-brand" aria-label="Evora home">
          <Logo />
        </a>
        <div className="auth-form-container">
          <span className="eyebrow">Your company, together.</span>
          <h1>
            {params.get("mode") === "signup"
              ? "A little more room for your business."
              : "Welcome back."}
          </h1>
          <p className="auth-description">
            Sign in or create your account with Google or GitHub.
          </p>
          {invite && (
            <div className="invite-auth-note">
              You’ve been invited to a company. Use the Google or GitHub account
              with the email address your invitation was created for.
            </div>
          )}
          <div
            className="auth-providers"
            role="group"
            aria-label="Sign-in options"
            aria-busy={availability.isPending || Boolean(pending)}
          >
            {AUTH_PROVIDERS.map(({ id, name }) => (
              <Button
                key={id}
                variant="outline"
                className="auth-provider-button"
                disabled={
                  Boolean(pending) || !availability.data?.providers.includes(id)
                }
                onClick={() => signIn(id)}
              >
                {pending === id ? (
                  <Loader2 size={18} className="spin" aria-hidden="true" />
                ) : (
                  <ProviderIcon provider={id} />
                )}
                Continue with {name}
              </Button>
            ))}
          </div>
          <div role="status" className="auth-status">
            {pending ? (
              "Opening your sign-in provider…"
            ) : availability.isPending ? (
              "Loading sign-in options…"
            ) : availability.isError ? (
              <>
                Unable to load sign-in options.{" "}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => availability.refetch()}
                >
                  Try again
                </Button>
              </>
            ) : !availability.data?.providers.length ? (
              "Sign-in isn’t available yet. You can explore the demo below."
            ) : (
              "Your first sign-in creates your Evora account."
            )}
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <a
            href="/"
            onClick={() => localStorage.removeItem("evora:signed-in")}
            className="explore-demo"
          >
            Take a look around first
            <ArrowRight size={14} />
          </a>
        </div>
      </main>
      <aside className="auth-aside">
        <div className="auth-aside-content">
          <span className="eyebrow">A clear space for your company</span>
          <h2>
            Less admin.
            <br />
            More possibility.
          </h2>
          <p>
            The finances, the plans, the little details. Finally, all in one
            place.
          </p>
          <div className="auth-paper-scene" aria-hidden="true">
            <div className="auth-paper back">
              <span />
              <span />
              <span />
            </div>
            <div className="auth-paper middle">
              <span />
              <span />
              <span />
            </div>
            <div className="auth-paper front">
              <Logo />
              <span className="paper-heading">Everything, in its place.</span>
              <div className="paper-check">
                <Check size={13} />
                Finances in perspective
              </div>
              <div className="paper-check">
                <Check size={13} />
                Documents close at hand
              </div>
              <div className="paper-check">
                <Check size={13} />
                Room for what’s next
              </div>
              <span className="paper-signature">A little peace of mind.</span>
            </div>
          </div>
          <div className="auth-aside-footer">
            <Logo variant="monochrome" />
          </div>
        </div>
      </aside>
    </div>
  );
}
