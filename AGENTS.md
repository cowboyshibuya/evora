# Evora project instructions

## Reuse and UI/UX consistency — required

- Before adding or changing a component, function, hook, type, constant, or style, search for an existing implementation and its callers.
- Do not introduce useless duplicates. Reuse shared components and functions; consolidate existing duplicate implementations when changing that area.
- When an existing pattern needs a different presentation, extend it with a small, typed variant or an explicit composition slot. Keep one implementation of its behavior, accessibility, loading, empty, error, and disabled states.
- Use shared UI primitives in `src/components/ui`, shared application components, semantic design tokens, and existing spacing and typography conventions. Keep equivalent interactions consistent throughout the app.
- Financial calculations, permissions, validation, and domain options must have a shared source of truth in `src/lib` used by both browser and server code where appropriate. The server must still validate input and enforce authorization.
- Extract a shared abstraction for repeated behavior or a repeated visual pattern. Do not create speculative variants, unused helpers, or a large configurable component for unrelated workflows. Similar markup is acceptable when it represents different behavior and sharing would make the code harder to understand.
- Remove imports, helpers, props, and styles made obsolete by a refactor. Update all affected callers and run the relevant checks.

## Tooling and verification

- Use **Bun** for dependencies and scripts. Commit `bun.lock`; do not create npm, pnpm, or Yarn lockfiles.
- Run `bun run typecheck`, relevant tests, and `bun run build` after changes to shared behavior. Keep meaningful coverage for money rounding, company isolation, permissions, exports, and keyboard/mobile interactions.
- Preserve existing app behavior and page layouts during refactors unless a behavior change is explicitly part of the request.
- Never commit credentials, local database state, or real company documents.
- Production releases use `bun run build:ci` followed by `bun run deploy`. Keep the migration-before-publication checks in `scripts/deploy.ts`; do not bypass them with a direct deploy command. Keep production resource identifiers in `config/production.ts` and use separate resources for previews.

## Cloudflare CLI - cf - v20260928

`cf` is Cloudflare's current CLI and covers the whole Cloudflare platform. Prefer it over Wrangler: create projects with `cf init`, develop with `cf dev`, deploy with `cf deploy`, and manage account resources with `cf <product> …` (for example `cf d1 list`).

Wrangler is only for projects that already use it — a `wrangler.jsonc`, `wrangler.json` or `wrangler.toml` file — or when the user asks for it. Keep using Wrangler in those projects unless asked to migrate, and use `cf migrate` in this case.

`cf` commands differ from Wrangler's; check `cf --help` or `cf cli search <what you want to do>` instead of guessing. If a `cf` command fails in a project that doesn't use Wrangler, don't fall back to Wrangler (including `npx wrangler`) without offering to report it.

The CLI is a project development dependency: use `bun run cf …`. Bun manages its installation; the CLI itself uses its Node.js executable.
