# Evora

A clear space for your company. Evora centralizes day-to-day bookkeeping, invoices, financial planning, documents, notes, and contacts in one minimal workspace.

Open source under **AGPL-3.0-only**.

## Stack

- **Bun** for package management and project scripts
- **TanStack Start** and TanStack Router, React, TypeScript
- **Cloudflare Workers**, **D1** (SQLite) and **R2**
- **Drizzle ORM**, **Better Auth**, Zod
- **Tailwind CSS v4** and **shadcn/ui** and Radix components
- Recharts, ExcelJS, JSZip, pdf-lib
- Playwright and axe for browser and accessibility checks

### Why D1?

Company records are relational, and D1 fits the Workers runtime without an external database connection. Drizzle keeps the schema explicit and the SQLite data model portable. Files live in R2; searchable metadata stays in D1. Each request checks the signed-in user's company membership, including file downloads. PostgreSQL is a reasonable future option for more sophisticated accounting workloads, but is not required to run this app.

## Run locally

Requires Bun 1.4+ and a Node.js version supported by Vite and the Cloudflare Vite plugin. No Cloudflare account is needed for local development.

```sh
bun install
bun run dev
```

Open **http://localhost:3000**. The Cloudflare Vite plugin runs the actual Workers runtime locally, with persistent local D1 and R2 storage in `.wrangler/state/` (ignored by Git). The development server is Vite; no Wrangler CLI commands are needed.

The first visit opens a **private anonymous demo** with two sample companies. Demo data is isolated per session. Visit `/auth?mode=signup` to create an account and start an empty company. Company onboarding supports currency, country, VAT number and financial-year start month.

The initial SQL migration is applied automatically **in development only**. Production requires applying all SQL migrations in `migrations/` before serving traffic.

## Features

- Google and GitHub sign-in/sign-up through Better Auth, sign-out, session listing and revocation
- Multiple companies, a company switcher, onboarding and company settings
- Owner, admin, member and viewer access; expiring email-bound invitation links
- Income and expense transactions, category filters, period filters, search and pagination
- CSV import with column mapping, validation, previews and duplicate-file protection
- Sales invoices and supplier bills, quantity and VAT calculation, drafts, due dates, overdue detection, PDF generation and payment recording
- Atomic, idempotent invoice payments; paid invoices and their payment records are locked against editing and deletion
- Calendar with invoice due dates, reminders and monthly/annual recurrence; completing a repeating reminder creates its next occurrence
- Documents with folder organization, drag-and-drop upload, downloads of original files and deletion
- Notes with collections, pinning, editing and Markdown exports
- Client, supplier, partner and accountant contacts
- Cash-based financial summaries, expense breakdowns and sales VAT summaries
- Global company search (`⌘ K` / `Ctrl K`) and in-app notifications for deadlines and overdue invoices
- Period and collection exports to Excel, CSV, JSON and ICS; complete ZIP archives with original documents, Markdown notes and generated invoice PDFs

All monetary values are stored as integer minor units (cents). A company has a single currency. Company currency cannot be changed once transactions exist. Date-only values are stored as ISO `YYYY-MM-DD`; timestamps use UTC.

## Authentication

Evora uses **Google and GitHub OAuth** through Better Auth, running inside the Worker. Users, provider accounts and sessions stay in D1. No Better Auth hosted project, Resend account, or email-sending service is required. A first sign-in creates the account and opens company onboarding; later sign-ins return to existing companies.

For local OAuth, copy `.env.example` to `.dev.vars` (ignored by Git), add the credentials below, and restart `bun run dev`. The anonymous demo works without provider credentials. Unconfigured providers remain disabled on the sign-in page; the public availability endpoint returns provider IDs only, never credentials.

| Name                   | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Random secret of at least 32 characters; generate with `openssl rand -base64 32` |
| `APP_URL`              | Exact production HTTPS origin, including the assigned `workers.dev` hostname     |
| `GOOGLE_CLIENT_ID`     | Google OAuth web application client ID                                           |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                                       |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App client ID                                                       |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret                                                   |

Keep the client secrets and `BETTER_AUTH_SECRET` in **Cloudflare Worker secrets**. Client IDs and `APP_URL` may be Worker variables. Both credentials are required to enable each provider. `APP_URL` is the base URL explicitly passed to Better Auth; a separate `BETTER_AUTH_URL` variable is not needed.

### Google setup

1. Create/select a project in [Google Cloud Console](https://console.cloud.google.com/), configure the Google Auth Platform consent screen with only the basic identity scopes, and create an OAuth client with application type **Web application**.
2. Add your exact app origin as an authorized JavaScript origin. Add this redirect URI: `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/auth/callback/google`.
3. For local development also add origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/callback/google` (or use a separate development client).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. While the consent screen is in Testing, add your intended accounts as test users. Publish the consent screen for a public launch and complete any requirements shown by Google.

See [Better Auth's Google guide](https://better-auth.com/docs/authentication/google).

### GitHub setup

1. In [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers), create an **OAuth App** with your Worker URL as its homepage.
2. Set its authorization callback URL to `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/api/auth/callback/github`.
3. Generate a client secret and configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the Worker.
4. Use a separate OAuth App for local development, with callback URL `http://localhost:3000/api/auth/callback/github`. GitHub OAuth Apps have a single callback URL. Better Auth requests `read:user` and `user:email`, including access to private email addresses.

See [Better Auth's GitHub guide](https://better-auth.com/docs/authentication/github).

### Invitations, recovery and existing accounts

Company admins create a seven-day invitation for an email address and role, then copy and share its link. No email is sent. The recipient must sign in with the **same verified email address** from Google or GitHub. The invitation survives the OAuth redirect, and acceptance switches to the invited company. A different address, an unverified address or an anonymous demo session cannot accept it.

Passwords, verification emails and recovery emails are managed by the provider. Evora's email/password signup, sign-in, reset and change endpoints are disabled. Active Evora sessions can still be viewed and revoked in **Settings → My account**. Better Auth retains its origin, state/PKCE, cookie and verified-email account-linking protections, plus database-backed rate limits.

The existing auth tables already support OAuth, so this change needs no new SQL migration. Existing **verified** users can sign in with a provider using the same verified address and retain their companies. Legacy unverified password-only accounts are not automatically linked; they need an explicit administrator-assisted ownership migration. Do not mark them verified in bulk. Historical migrations and the nullable credential column remain intact for existing databases; the development email inbox is no longer exposed or written to.

## Cloudflare CLI and deployment

Cloudflare's **`cf` CLI is installed as a project development dependency** and is available after `bun install`:

```sh
bun run cf --version
bun run cf auth whoami
bun run cf auth login
bun run cf cli search "list D1 databases"
```

Bun installs and launches the package; the CLI's executable runs with Node.js (22.18 or newer), as required by Cloudflare. Version `1.0.0-beta.18` was verified locally. Account provisioning and remote deployment have not been exercised by this project’s test suite.

Account and resource commands can be used independently of the app's build integration. Use `bun run cf --help` or `bun run cf cli search "describe the resource operation"` to find the current commands. Do not include credentials or identifying values in discovery queries.

The app's existing **Cloudflare Vite plugin v1** reads `cloudflare.config.jsonc`. Keep using `bun run dev` and `bun run build` for this integration. Cloudflare's new `cf dev`, `cf build`, and `cf deploy` workflow requires `cloudflare.config.ts` and a compatible build integration; that migration is separate from installing the CLI. The current CLI can automatically rewrite a project that has no `cloudflare.config.ts`, so preserve the existing entrypoint, `DB`/`FILES` bindings and local storage when deliberately migrating. See the [official project workflow](https://developers.cloudflare.com/cf/projects/).

Before remote deployment:

1. Authenticate with `bun run cf auth login` and select the intended account.
2. Create a D1 database and an R2 bucket using commands discovered through the CLI. Replace the placeholder D1 `database_id`, database name and bucket name in `cloudflare.config.jsonc` with your resources. Keep the binding names `DB` and `FILES`.
3. Set `APP_URL` to the deployed HTTPS origin and configure the secrets above.
4. Apply the SQL files in `migrations/` to your production D1 database, in filename order.
5. Complete the build integration migration before using `cf` project commands, and run the relevant checks.

No resources are created or published by `bun run build`.

## Checks

```sh
bun run typecheck
bun run build
bunx playwright install chromium
bun run test
```

Shared-domain tests cover fractional invoice-line rounding, zero-rate VAT, recorded invoice totals, due status, and the role permission matrix. The browser suite exercises persistence, switching companies, uploads and downloads, onboarding, VAT and invoice payment accounting, duplicate payment protection, PDF/Excel exports, cross-company access denial, viewer permissions, invitations, recurrence, OAuth callback state, provider failures, disabled credential endpoints and session revocation. It also checks core routes with axe and covers narrow-screen navigation. Browser tests use an isolated local server on port 3001 and a provider-boundary mock loaded only by `tests/vite.config.ts`; the real Better Auth session and callback handling remains in use. Production builds use `vite.config.ts` and contain no OAuth mock. A live Google/GitHub round trip still needs a manual check with real provider credentials.

## Project layout

```text
src/routes/             TanStack Start page routes and API catch-all
src/components/         Workspace screens, forms and dialogs
src/components/ui/      Shared shadcn/ui and Radix primitives, tables and search
src/lib/                Shared types, validation, finance and export helpers
src/server/             D1 schema, authentication, authorization, API and demo seed
migrations/             Versioned SQL migrations
tests/                  Browser integration tests
```

## Accounting scope

Evora implements operational bookkeeping and financial planning. The financial reports use a cash basis. Sales invoice VAT summaries do not calculate deductible purchase VAT or prepare tax returns. It does not yet implement a double-entry general ledger, bank-feed synchronization, payroll calculation, statutory accounts, e-invoicing network delivery or jurisdiction-specific tax filing. Reminders and invoice status notifications appear in the app; scheduled email/push reminder delivery is not implemented. PDF downloads and `Mark as sent` do not send invoices by email.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [shared UI catalog](src/components/README.md). Never commit production credentials, local database state or real company documents.

## References

- [TanStack Start](https://tanstack.com/start/latest/docs/framework/react/overview)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Better Auth](https://better-auth.com/docs/introduction)
