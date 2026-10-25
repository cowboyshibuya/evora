# Contributing to Evora

Use Bun and commit changes to `bun.lock` when dependencies change.

```sh
bun install
bun run dev
bun run typecheck
bun run test
bun run build
```

Keep interfaces light, calm, accessible and responsive. Reuse the components in `src/components/ui` and the semantic tokens in `src/styles.css`. Use sentence case and direct action labels.

The required reuse and consistency policy is in [AGENTS.md](AGENTS.md). Check the [shared UI catalog](src/components/README.md) before adding a component or variation. Typechecking rejects unused imports and local variables.

Server operations must check company membership. Viewers can read and export; members can manage records; admins and owners can manage company settings and access. Never trust a company ID, file key, amount or role from the browser without validation. Invoice payment records must stay atomic and idempotent. Store money in integer minor units.

Add SQL migrations for schema changes, and keep `src/server/schema.ts` aligned. Use isolated sample data in tests. Include meaningful validation for changes to accounting, access control, persistence or authentication.

Do not commit `.dev.vars`, `.env`, `.wrangler`, exported archives or real customer files. Use Cloudflare's `cf` CLI for account operations and inspect its help for supported commands. There is no Wrangler CLI dependency in the project scripts.
