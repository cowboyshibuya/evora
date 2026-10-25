# Evora instructions

Read and follow [AGENTS.md](./AGENTS.md), the canonical project instructions shared by all coding agents.

**Required rule:** do not introduce useless duplicates in components, functions, hooks, types, constants, or styles. Search first, reuse existing shared implementations, and add small typed variants or composition slots when a shared pattern needs another presentation. Consolidate duplicated behavior and keep equivalent UI/UX, accessibility, and interaction states consistent across the app. Do not add unused abstractions or speculative variants.

Use Bun for dependencies and scripts, the project-local `cf` CLI for Cloudflare management, and the verification commands documented in `AGENTS.md`.
