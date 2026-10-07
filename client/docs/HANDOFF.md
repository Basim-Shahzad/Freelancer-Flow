# Paylancr Phase 1 — handoff

## Route map
| Group | Routes |
|---|---|
| (marketing) | `/` (variant via `NEXT_PUBLIC_LANDING`), `/pk`, `/global` |
| (auth) | `/signup`, `/login`, `/forgot-password`, `/onboarding` (5 steps) |
| (app, inside AppShell, auth-gated) | `/dashboard`, `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit`, `/projects` (+ new, [id], [id]/edit), `/time`, `/invoices`, `/invoices/new`, `/invoices/[id]`, `/settings/{business,payment-methods,export,activity}` |
| (portal, no shell, no account) | `/p/[token]` (project), `/i/[token]` (invoice) |

## Tokens
All colour, type, radius and motion tokens live once in `app/globals.css` (`:root`, `.dark`) and are exposed to Tailwind via `@theme inline`. Components use semantic classes only (`bg-surface`, `text-muted-foreground`, `border-rule`, `text-primary-ink`…). Gold (`accent`) appears only at the Paid moment. The old shadcn oklch block from the original `globals.css` is intentionally NOT carried over — it conflicted with the brand tokens. If you run `shadcn add`, map its variables to these names.
Layout uses container queries (`@2xl:` etc.) and logical properties only, so RTL is a later flip, not a rewrite.

## Component map
`components/ui` = shadcn-style primitives (button, input, dialog, tabs, switch, checkbox, radio-group, dropdown-menu, tooltip, tag, notice, segmented, ledger rows, section/page layout). `components/domain` = StatusChip, Money (with labelled estimates), StageThread, InvoiceDocument, PaymentMethodForm, StateBlock. Feature folders: shell, marketing, auth, dashboard, clients, projects, time, invoices, settings, portal.

## Money rules (enforced in copy and tests)
No "Pay now" anywhere. Converted figures always read "≈ estimate · ref. rate <date>" with the reference-rate note. Invoice and portal carry "Paylancr does not process payments. Pay the freelancer directly using the details below." Money is integer minor units; status is derived (`deriveStatus`) from stored draft/unpaid/written_off/void plus payments and due date.

## Replacing the mock layer
1. `lib/store/index.ts` is the only data source; every screen reads selectors from `lib/selectors.ts` or store actions. Replace actions with API calls (React Query recommended) keeping the same names/signatures.
2. Auth: `session` in the store; `AppShell` gates routes. Swap for real sessions (cookies + middleware) and make the portal routes resolve `token` server-side.
3. Server pages are thin; data views are client components, so moving fetches to server components is incremental.
4. Delete `StoreBootstrap` rehydration and the `useHydrated()` gates once data is remote (use Suspense/loading.tsx, already present per route).
5. `lib/seed.ts` is demo-only.

## Known limitations
- Phase 2 (tax, ESFCA tracker, bank pack, CSV import, Drive, pricing) intentionally absent.
- Mock auth: any email, password 8+ chars. Signup country is passed via sessionStorage; display currency is not saved.
- Export is client-side JSON + invoices CSV (no ZIP). Logo upload is name-only. 
- No "Edit draft" flow for invoices; creating an invoice never sends it (send is a separate action).
- Time-sync conflicts use a demo rule with a simulated server copy; seed has no unsynced entries, so those states appear after going offline/editing.
- Clients with projects or invoices cannot be deleted; project form omits due date, deposit %, estimated hours.
- Unsaved-changes guard does not cover sidebar navigation.
- Print stylesheet needs `:has()` support.
- Portal copy uses "they" for the freelancer's changes prompt.
- Dark mode and mobile were spot-checked, not audited screen by screen. Automated: 179 unit/smoke tests; no e2e suite.

## Round 2: reference-UI port
Adopted from the earlier static UI: pill buttons/chips, Card panels (14px) and KpiStrip, the Time week view (with Week|List toggle), the Invoice detail layout (stamp, action rail, real-events timeline, Money card), the dashboard "Owed to you" hero with stage arrows and the Today card, projects "what each is paying you" (effective hourly rate vs your rate) and KPI strips on projects/clients.
Deliberately NOT ported: project status/progress bars, client invoice bars, the rail sidebar, the twelve-week landing card, briefing card, "who's holding things up", invoices "days on the road", predictions ("likely payment").
New data: `TimeEntry.startTime` (HH:MM, optional), `BusinessProfile.hourlyRate` (optional, minor units). Persist version is now 2.
Known: dashboard "Active projects" card still has small progress bars; seed has few entries this week so the week grid looks sparse.
