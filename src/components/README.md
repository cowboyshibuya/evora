# Shared UI patterns

Follow the reuse rule in [AGENTS.md](../../AGENTS.md). Search here before creating another implementation. Keep behavior and accessibility in shared components; let screens supply their business content.

| Pattern                                                          | Shared implementation         | Existing variations                                                                           |
| ---------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| Search field                                                     | `ui/search-input.tsx`         | `default`, `command`; one accessible label and value-change API                               |
| Record tables                                                    | `ui/data-table.tsx`           | `default`, `dashboard`, `invoice`; typed columns and row keys                                 |
| Table controls                                                   | `TableToolbar`, `TableFooter` | Composed search, filters, counts and pagination actions                                       |
| Financial summaries                                              | `summary-strip.tsx`           | Three or four columns; semantic amount tones and optional icons                               |
| Cash-flow charts                                                 | `cash-flow-chart.tsx`         | `overview`, `report`; shared series, axes, tooltip and colors                                 |
| Avatars                                                          | `Avatar` in `common.tsx`      | `default`, `party`; consistent company colors                                                 |
| Company identity                                                 | `company-logo.tsx`            | `CompanyAvatar`, shared onboarding/settings `CompanyLogoUpload`; validated raster images      |
| Quick add                                                        | `quick-add-menu.tsx`          | Toolbar and calendar-day menus, shared shortcut labels; actions in `src/lib/quick-actions.ts` |
| Branding                                                         | `Logo` in `common.tsx`        | Default logo and monochrome footer wordmark                                                   |
| Dialogs                                                          | `ui/dialog.tsx`               | `default`, `wide`, `note`, `search`; one close button, focus and description implementation   |
| Page/section headings, empty states, statuses and record actions | `common.tsx`                  | Title-only headings with composed action slots                                                |

Use semantic CSS tokens and these components' existing classes instead of copying styles to a page. Add a typed variant when an actual caller needs another presentation; avoid speculative variants and unrelated configuration flags.

Business rules belong in `src/lib`, not UI modules. Invoice line rounding, totals and due status live in `invoices.ts`; company access rules live in `permissions.ts`; currency and financial-year choices live in `company-options.ts`. The API validates inputs and enforces the shared permission rules independently of the UI.
