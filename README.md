# ![Evora](public/brand/evora-logo-transparent.svg)

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

Requires Bun 1.4+ and Node.js 24 (see `.node-version`; the CLI requires at least 22.18). No Cloudflare account is needed for local development.

```sh
bun install
bun run dev
```

Open **http://localhost:3000**. The Cloudflare Vite plugin runs the actual Workers runtime locally, with persistent local D1 and R2 storage in `.wrangler/state/` (ignored by Git). The development server is Vite; no Wrangler CLI commands are needed.

The first visit opens a **private anonymous demo** with two sample companies. Demo data is isolated per session. Visit `/auth?mode=signup` to create an account and start an empty company. Company onboarding supports currency, country, VAT number and financial-year start month.

Pending SQL migrations are applied automatically during local development. In production, the deployment script applies pending migrations before publishing the Worker.

## Features

- Google and GitHub sign-in/sign-up through Better Auth, sign-out, session listing and revocation
- Multiple companies, a company switcher, onboarding and company settings with private company-logo uploads
- Owner, admin, member and viewer access; expiring email-bound invitation links
- Income and expense transactions, category filters, period filters, search and pagination
- CSV import with column mapping, validation, previews and duplicate-file protection
- Sales invoices and supplier bills, quantity and VAT calculation, drafts, due dates, overdue detection, PDF generation and payment recording
- Atomic, idempotent invoice payments; paid invoices and their payment records are locked against editing and deletion
- Calendar with invoice due dates, reminders and monthly/annual recurrence; completing a repeating reminder creates its next occurrence
- Calendar day quick-add menus that carry the selected date into new records and document uploads
- Two-key creation shortcuts, shown in the shared quick-add menus and Help & shortcuts
- Documents with folder organization, drag-and-drop upload, downloads of original files and deletion
- Notes with collections, pinning, editing and Markdown exports
- Client, supplier, partner and accountant contacts
- Cash-based financial summaries, expense breakdowns and sales VAT summaries
- Global company search (`⌘ K` / `Ctrl K`) and in-app notifications for deadlines and overdue invoices
- Period and collection exports to Excel, CSV, JSON and ICS; complete ZIP archives with original documents, Markdown notes and generated invoice PDFs

All monetary values are stored as integer minor units (cents). A company has a single currency. Company currency cannot be changed once transactions exist. Date-only values are stored as ISO `YYYY-MM-DD`; timestamps use UTC.

## Company logos

Choose a PNG, JPEG, or WebP logo (up to 2 MB) during onboarding or in **Settings → Company**. Company details and the selected logo save together. Admins and owners can replace or remove the logo; other company members can view it. Files stay in private R2 storage and are served through a company-scoped endpoint. Complete ZIP exports include the logo’s original bytes.

Migration `0003_company_logos.sql` is applied by the production deployment script. Existing companies start without a logo and retain their records. Local development applies pending migrations automatically.

## Keyboard shortcuts

Press **N**, then the second key within 1.2 seconds. These are sequences, not simultaneous key presses.

| Sequence | Action          |
| -------- | --------------- |
| N → I    | Create invoice  |
| N → T    | Add transaction |
| N → R    | Create reminder |
| N → N    | Write a note    |
| N → C    | Add contact     |
| N → D    | Upload document |

Creation shortcuts pause while typing in a field, using a menu, or working in a dialog. They also respect company roles. `⌘ K` / `Ctrl K` continues to open search.

## Authentication

Evora uses **Google and GitHub OAuth** through Better Auth, running inside the Worker. Users, provider accounts and sessions stay in D1. No Better Auth hosted project, Resend account, or email-sending service is required. A first sign-in creates the account and opens company onboarding; later sign-ins return to existing companies.

For local OAuth, copy `.env.example` to `.dev.vars` (ignored by Git), add the credentials below, and restart `bun run dev`. The anonymous demo works without provider credentials. Unconfigured providers remain disabled on the sign-in page; the public availability endpoint returns provider IDs only, never credentials.

| Name                   | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Random secret of at least 32 characters; generate with `openssl rand -base64 32` |
| `APP_URL`              | Set from `config/production.ts`; local development uses `http://localhost:3000`  |
| `GOOGLE_CLIENT_ID`     | Google OAuth web application client ID                                           |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                                       |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App client ID                                                       |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret                                                   |

The five authentication values are declared as **Cloudflare Worker secrets** in `cloudflare.config.ts`. Store them in the Worker's **Settings → Variables & Secrets** for production, or in `.dev.vars`/`.env.local` for local development. Local secret files are never uploaded by the deployment script. Both credentials are required to enable each provider. `APP_URL` is an inline configuration binding, not a secret; change the production origin in `config/production.ts`. It is explicitly passed to Better Auth, so a separate `BETTER_AUTH_URL` variable is not needed.

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

The existing auth tables already support OAuth, so the authentication change itself required no new SQL migration. Company logos require migration `0003`, as described above. Existing **verified** users can sign in with a provider using the same verified address and retain their companies. Legacy unverified password-only accounts are not automatically linked; they need an explicit administrator-assisted ownership migration. Do not mark them verified in bulk. Historical migrations and the nullable credential column remain intact for existing databases; the development email inbox is no longer exposed or written to.

## Cloudflare CLI and deployment

Cloudflare's **`cf` CLI is installed as a project development dependency** and is available after `bun install`:

```sh
bun run cf --version
bun run cf auth whoami
bun run cf auth login
bun run cf cli search "list D1 databases"
```

Bun installs and launches the package; the CLI's executable runs with Node.js. The CLI and Vite plugin v2 beta are pinned in `package.json` and `bun.lock`. The project uses typed `cloudflare.config.ts` configuration and emits deployable Build Output in `.cloudflare/output/v0/`. Local storage stays in `.wrangler/state/`, with remote development bindings disabled. [Cloudflare project workflow](https://developers.cloudflare.com/cf/projects/).

Account and resource commands can be used independently of the app's build integration. Use `bun run cf --help` or `bun run cf cli search "describe the resource operation"` to find the current commands. Do not include credentials or identifying values in discovery queries.

`config/production.ts` is the shared source of truth for the production account, Worker, D1 database, R2 bucket, branch, and app origin. Its identifiers are public configuration, not credentials. Forks must replace these values with their own resources. Keep binding names `DB` and `FILES`. Worker binding types are generated from the configuration by `bun run types`; `bun run typecheck` runs this automatically.

### Connect GitHub to Workers Builds

1. Confirm the resources and HTTPS origin in `config/production.ts`. The current target uses the existing `evora` D1 database and private `evora-documents` R2 bucket in the `cowboy` account.
2. In Cloudflare, create/connect the **evora** Worker to this GitHub repository, with production branch **main** and root directory `/`.
3. Set **Build command** to `bun run build:ci` and **Deploy command** to `bun run deploy`. Replace the dashboard defaults before the first build. The package manager is Bun, selected by `packageManager` and `bun.lock`; `.node-version` selects Node.js 24.
4. Select a build API token scoped to the intended account. It needs **D1: Edit** for migrations, **Workers Scripts: Edit** for deployment, and permissions to access the configured R2 bucket. Check the token's permissions: the automatically generated Workers Builds token may omit D1. These are build credentials, separate from the app's runtime secrets. [Build settings and tokens](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
5. Add the five authentication secrets from the Authentication section to the Worker, and configure the production Google/GitHub callback URLs. Do not add them to the repository or make them `VITE_` variables.
6. Disable **non-production branch / preview builds** initially. Both the config and deployment script refuse previews using production resources. Set up separate D1/R2 resources before enabling previews; do not use a generic deploy command for them.
7. Trigger the production build. Later pushes to `main` run the same workflow automatically.

The build command generates types, checks TypeScript, runs the domain/migration/deployment tests without a browser, builds the app, and performs a Cloudflare deployment dry run. GitHub's separate **Checks** workflow also runs the full browser/accessibility suite on pushes and pull requests. Use that status as a required check on `main` to keep unverified pull requests from being merged; Workers Builds does not wait for a separate GitHub check after a push.

The deploy command checks the compiled account, mode, bindings, and origin; validates the package; applies pending migrations through `cf d1 migrations apply`; confirms none remain; and publishes that same build with `cf deploy --prebuilt`. Errors stop publication. It rejects non-main CI branches and account mismatches before any database operation.

### Migrations and manual releases

Add a new numbered SQL file to `migrations/` whenever the schema changes, and update `src/server/schema.ts`. Do not edit previously applied migrations. D1 tracks applied filenames in `d1_migrations`, so deployments apply only new files. First deployment initializes an empty database. If adopting a database that already had SQL applied outside the migration runner, reconcile its migration history before using automated deployment.

Keep migrations compatible with the currently running Worker: add fields/tables first, deploy code that uses them, and remove obsolete fields in a later release. Code rollback does not reverse database migrations. Use D1 Time Travel when a database restore is needed. Keep one production deployment running at a time.

For a manual release after authentication:

```sh
bun run build:ci
bun run deploy
```

No resources are created or published by `bun run build`, `bun run build:ci`, or `bun run deploy:check`. The production migration and deployment happen only in `bun run deploy`. A successful dry run validates packaging, not remote authentication or runtime secrets. [D1 migration tracking](https://developers.cloudflare.com/d1/reference/migrations/).

## Checks

```sh
bun run typecheck
bun run test:unit
bun run build
bunx playwright install chromium
bun run test
```

Shared-domain tests cover fractional invoice-line rounding, zero-rate VAT, recorded invoice totals, due status, and the role permission matrix. The browser suite exercises persistence, switching companies, uploads and downloads, onboarding, VAT and invoice payment accounting, duplicate payment protection, PDF/Excel exports, cross-company access denial, viewer permissions, invitations, recurrence, OAuth callback state, provider failures, disabled credential endpoints and session revocation. It also checks core routes with axe and covers narrow-screen navigation. Logo coverage checks onboarding, replacement/removal, original-byte exports, input validation and company/role boundaries. Calendar and hotkey tests check selected dates, document uploads, typing guards and touch-sized layouts. The logo migration is tested against an existing database with company records. Browser tests use an isolated local server on port 3001 and a provider-boundary mock loaded only by `tests/vite.config.ts`; the real Better Auth session and callback handling remains in use. Production builds use `vite.config.ts` and contain no OAuth mock. A live Google/GitHub round trip still needs a manual check with real provider credentials.

## Project layout

```text
src/routes/             TanStack Start page routes and API catch-all
src/components/         Workspace screens, forms and dialogs
src/components/ui/      Shared shadcn/ui and Radix primitives, tables and search
src/lib/                Shared types, validation, finance and export helpers
src/server/             D1 schema, authentication, authorization, API and demo seed
migrations/             Versioned SQL migrations
config/production.ts    Shared production resource identifiers and origin
cloudflare.config.ts    Worker bindings and local/production configuration
scripts/deploy.ts       Validate, migrate, verify, then publish production
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
