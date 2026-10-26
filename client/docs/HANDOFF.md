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
- Clients with projects or invoices cannot be deleted; the project form has no deposit % or estimated hours (the API has neither; see "Projects").
- Unsaved-changes guard does not cover sidebar navigation.
- Print stylesheet needs `:has()` support.
- Portal copy uses "they" for the freelancer's changes prompt.
- Dark mode and mobile were spot-checked, not audited screen by screen. Automated: 179 unit/smoke tests; no e2e suite.

## Round 2: reference-UI port
Adopted from the earlier static UI: pill buttons/chips, Card panels (14px) and KpiStrip, the Time week view (with Week|List toggle), the Invoice detail layout (stamp, action rail, real-events timeline, Money card), the dashboard "Owed to you" hero with stage arrows and the Today card, projects "what each is paying you" (effective hourly rate vs your rate) and KPI strips on projects/clients.
Deliberately NOT ported: project status/progress bars, client invoice bars, the rail sidebar, the twelve-week landing card, briefing card, "who's holding things up", invoices "days on the road", predictions ("likely payment").
New data: `TimeEntry.startTime` (HH:MM, optional), `BusinessProfile.hourlyRate` (optional, minor units). Persist version is now 2.
Known: dashboard "Active projects" card still has small progress bars; seed has few entries this week so the week grid looks sparse.

## Business profile (API-backed since step 3)

`GET/PATCH /profile` is the source of truth for the business profile; read it through `useBusiness()` (view model) / `useProfile()` (query state) in `lib/hooks/profile`. `ownerName` and `email` come from the signed-in user. "Onboarded" is derived: the profile has a `businessName` (`useOnboarded()`).

The API has no home for `phone`, `footerNote`, `logoName`, `invoicePrefix` and `nextInvoiceNumber` (`invoiceNumberFormat` is a different shape). They stay in the persisted store as `businessLocal` (persist version 3), so they do **not** follow the user across devices. The token-based client portal still reads the demo `seedBusiness` until step 13.

## Clients (API-backed since step 4)

`/clients` is the source of truth: `useClients(params)` (infinite list, server-side `search`), `useClient(id)`, `useCreateClient` / `useUpdateClient` / `useDeleteClient` in `lib/hooks/clients`. Screens that only need a name/colour for a `clientId` use the cached `useClientOptions()`.

- The API has no `contactName`, `city`, `country` or `prefersMethods`. The model now has `companyName`, `phone`, `address`, `taxId`, `whatsapp` and `paymentTermsDays`. Preferred methods are replaced by the invoice-level picker in step 9.
- The server normalises WhatsApp numbers; the UI shows what it returns.
- Delete returns `409` when the client has invoices; the dialog shows the server message and keeps the client.
- Stats that depend on unmigrated domains (worth per hour, outstanding, overdue, average days to pay, the invoice list) are hidden on the clients screens until steps 6 and 8.
- Mock projects/invoices/time still carry mock `clientId`s (`c-harbor`, …). They no longer resolve and render an "Unknown client" fallback until their own step migrates them. Persist version is now 4 and drops the stale mock clients.

## Payment methods (API-backed since step 5)

`/payment-methods` is the source of truth: `usePaymentMethods()` (all methods in `sortOrder`, inactive included; filter on `enabled`), `usePaymentMethod(id)`, `useCreatePaymentMethod` / `useUpdatePaymentMethod` / `useDeletePaymentMethod`, and the optimistic-with-rollback `useReorderPaymentMethods` / `useSetDefaultPaymentMethod` / `useTogglePaymentMethod` in `lib/hooks/payment-methods`. The view model keeps lowercase `kind`s; `lib/api/mappers/payment-methods.ts` maps them to the API `type`s and `isActive` to `enabled`.

- `fields` is the API's `details` object, keyed exactly as the server returns it (camelCase, normalised: IBANs upper-cased without spaces, PK mobiles as `+92…`). The form shows those values on re-open. A PATCH replaces `details` wholesale, and the server rejects unknown keys, so `toDetails` sends only the keys the kind (and `BANK_TRANSFER` scheme) accepts.
- Keys per type: `PAYONEER` accountEmail / paymentRequestUrl (one of them) + optional accountHolder, bankName, iban, swiftBic · `ESFCA_WIRE` beneficiaryName, bankName, iban, swiftBic, bankAddress, purposeOfPayment? · `ELEVATE_PAY` accountHolder, accountNumber, routingNumber, bankName, accountType · `WISE_TO_IBAN` beneficiaryName, iban, bankName, note? · `PKR_BANK_TRANSFER` accountTitle, bankName, iban, accountNumber? · `RAAST` accountTitle + raastId / iban (one of them) · `JAZZCASH` / `EASYPAISA` mobileNumber, accountTitle · `OTHER` instructions (its name is the top-level `label`) · `BANK_TRANSFER` accountHolder, bankName, country, currency, bankAddress?, referenceNote?, `scheme` (a flat field, not nested) + the scheme's own keys (`BANK_SCHEMES` in `lib/payment-methods.ts`: IBAN, ACH, UK_SORT_CODE, SWIFT_OTHER).
- Every method has a required top-level `label`. The first method created becomes the default; making an inactive method the default also activates it. `PUT /order` needs every id exactly once.
- 422s come back as one message listing every problem (`"iban: …; swift_bic is required for scheme …"`). `mapMethodErrors` (`components/domain/payment-method-errors.ts`) splits it onto the form's fields; the form is not react-hook-form, so it takes an `errors` prop instead of `applyApiFieldErrors`.
- Delete refetches rather than dropping the row: the server soft-deletes a method that invoice snapshots reference.
- Interim behaviour until their own steps: mock invoices still reference `pm-…` ids that no longer exist, so their "How to pay" blocks list no methods. The client portal has no auth until step 13, so it only shows methods while the owner is signed in on that browser; everyone else sees "contact the freelancer". Invoice create waits for the methods query before it seeds its state. Persist version is now 5 and drops the stale mock methods.

## Projects and milestones (API-backed since step 6)

`/projects` and `/milestones` are the source of truth. Hooks: `useProjects({ search, clientId, status })` (infinite, server-side filters, "Load more"), `useProject(id)`, `useCreateProject` / `useUpdateProject(id)` / `useDeleteProject`, `useRetainerPeriods(project)`, and `useProjectOptions()` (every project, cached, for dropdowns and for screens that are not migrated yet) in `lib/hooks/projects`; `useMilestones(projectId, currency, enabled)`, `useCreateMilestone` / `useUpdateMilestone` / `useDeleteMilestone` / `useSubmitMilestone` and the optimistic-with-rollback `useReorderMilestones` in `lib/hooks/milestones`. Mappers: `lib/api/mappers/{projects,milestones}.ts` (lowercase billing types and statuses in the UI, uppercase on the wire; money via `lib/api/money.ts`).

- Billing types are `fixed | hourly | retainer | milestone`. A FIXED project's price is `budget`. `milestonesEnabled` is optional for every type and always true for MILESTONE; the milestone panel (add, edit, delete, reorder, move through statuses, submit for approval) is hidden when it is false, and milestones are never fetched then (creating one is a 422).
- Retainers need `retainerAmount` and `retainerInterval`; the server only accepts `MONTHLY` and `QUARTERLY` (the schema also lists `YEARLY`, which is rejected), so the form offers those two. HOURLY falls back to the profile rate when the project has none, so the form's rate is optional.
- `progressPercent` is computed by the server and can be `null`: the UI shows "—" (never 0%). The old manual "percent complete" field is gone.
- Milestone statuses are `PENDING | IN_PROGRESS | SUBMITTED | APPROVED | REJECTED`. `milestoneActions` (`components/projects/logic.ts`) mirrors the server's transition matrix; "Submit for approval" is `POST /milestones/{id}/submit` (the GET form is deprecated and never used) and emails the client a portal link, so it asks for confirmation. The wire field for a milestone's title is `name`.
- Project statuses are `DRAFT | ACTIVE | PAUSED | COMPLETED | ARCHIVED | CANCELLED`. A project with invoices cannot be deleted (409); the dialog says to archive it.
- The retainer periods list shows invoiced vs not-yet-invoiced from `invoiceId`. The "invoice this period" action arrives with step 9.
- The mock-only parts of the project screens are hidden until their steps: the "what each project pays you" ledger (`rate.ts` / `rate-row.tsx` / `kpi-money.tsx` are kept, adapted and tested, but not rendered), the stage thread, linked time and linked invoices (steps 7-9), the client share link and "Open client view" (the API has no project share token).
- Unmigrated screens (time, invoices, dashboard, global timer, export) read projects through `useProjectOptions()`. Mock invoices, time and the running timer still carry mock `projectId`s (`p-harbor`, …) that no longer resolve, so they show no project until their own step. The dashboard and the "Create invoice" project list do not load every project's milestones or retainer periods, so milestone / retainer items only appear once the project is chosen in the invoice flow. Milestones and retainer periods count as invoiced there when a live invoice line references them, because the milestone API has no `invoiceId`.
- The account-less client portal (`/p/[token]`) keeps its own mock `portalProjects` (types `PortalProject` / `PortalMilestone`) with approve / request-changes actions until step 13. Persist version is now 6 and drops the stale mock `projects`.

Backend gaps to raise: deposit %, estimated hours, a project share token (needed by step 13 and by "Copy client link"), `YEARLY` retainers (if still wanted), `invoiceId` on milestones, and a `startDate` / `notes` split (the form's "Scope and notes" is the API's `description`).

## Time tracking and the global timer (API-backed since step 7)

`/time-entries` is the source of truth. Hooks in `lib/hooks/time-entries`: `useRunningTimer()` (refetches on focus and after every mutation), `useStartTimer` / `useStopTimer`, `useCreateTimeEntry` / `useUpdateTimeEntry` / `useDeleteTimeEntries`, `useBulkUpdateTimeEntries` and `useAllTimeEntries(projectIds)`; `timeKeys` is the key factory. Mapper: `lib/api/mappers/time-entries.ts` (UTC ISO timestamps on the wire; the view model carries the local `date`, `HH:MM` and whole `minutes`).

- **A project is mandatory.** The server requires `project_id` and a non-empty `description` on start, create and sync, so there is no "internal / no project" time any more: Start is disabled until a project is picked, the form requires one, and the `NO_PROJECT` filter is gone. A project cannot be changed in the edit form (the PATCH takes none); use Select → Change project (bulk).
- **No "list all" endpoint (by decision).** `useAllTimeEntries` fetches `GET /time-entries/{project_id}` for every project (100 per request, in parallel) and returns nothing until all have loaded, so totals are never partial.
- **One timer per user.** A second start is a 409 whose `detail` is toasted. The top-bar timer, the Time screen's running row and the dashboard card all read the same `useRunningTimer` query.
- **Invoiced entries are locked** (`isInvoiced`): the row shows an "Invoiced" tag and a lock, the form opens read-only with the reason, and bulk selection skips them. The API exposes no invoice id on an entry, so the old link to the invoice and the "paid" fill in the week view are gone until the invoices migration.
- **Bulk edit** is one all-or-nothing `PATCH /time-entries/bulk { ids, set }` (project, milestone, billable, description), at most 200 ids (refused client-side beyond that). 409 (invoiced), 404 (an id that is not the caller's) and 422 (milestone outside the target project) show the server's `detail`. The screen refetches afterwards because changing the project re-resolves rates on the server. Delete has no bulk endpoint, so it loops and reports the entries the server refused.
- **Offline outbox** (`lib/time/outbox.ts` pure logic, `lib/time/outbox-store.ts` persisted zustand): start, stop, log, edit and delete made offline (or when the network drops mid-call) are folded to one item per entry id and replayed through `POST /time-entries/sync` in chunks of 200, in order, one flush at a time, on the `online` event and on mount (`useTimeSync`). Every result is handled on its own: `created/updated/deleted` leave the queue, `conflict` and `rejected` move to the panels on the Time screen, `warning: overlap` flags the entry. A network failure leaves everything queued. It is stored under `paylancr-time-outbox`; the mock `markSynced` and the demo conflict rule are gone.
- The mock store keeps a read-only `time` array only for invoice creation (step 9), the dashboard (step 11) and export (step 12), which delete it. Persist version is now 7 and drops the stale mock `timer`.

Backend gaps to raise: no internal (project-less) time, no list-all endpoint (decided), no invoice id on a time entry (only `isInvoiced`), and the status a single `PATCH` on an invoiced entry returns is unverified (the UI locks it before sending).

## Invoices: list, detail, lifecycle (API-backed since step 8)

`/invoices` is the source of truth for the list and the detail screens. Hooks in `lib/hooks/invoices` (see CONVENTIONS), service `lib/services/invoices.service.ts`, wire types `lib/api/invoices.types.ts`, mapper `lib/api/mappers/invoices.ts`.

- **Status** is the server's `displayStatus` (DRAFT, SENT, PARTIALLY_PAID, PAID, WRITTEN_OFF, CANCELLED, OVERDUE) mapped onto the existing chip statuses (SENT -> unpaid, PARTIALLY_PAID -> partial, CANCELLED -> void; "Void" is now "Cancelled" in the copy). Totals (`subtotal`, `discountAmount`, `taxAmount`, `withholdingAmount`, `total`, `amountPaid`, `balanceDue`) are the server's. Withholding shows only when non-zero, and the server's `total` is already net of it.
- **List:** server search (invoice number only), client and status filters, "Load more". The "Unpaid" filter has no single server value (SENT and PARTIALLY_PAID both exclude overdue), so the hook asks for both and merges them, advancing each from its own offset. The overdue count (header and sidebar badge) is `useInvoices({ status: "overdue", limit: 1 }).total`.
- **Send / share:** every channel moves a draft to sent. Email sends the PDF (a failed delivery keeps the invoice sent, warns, and offers WhatsApp / copy link); WhatsApp opens the server's prepared `whatsappUrl` in a new tab; Copy link copies `portalUrl`. An issued invoice only gets fresh links (`GET /share`); nothing is re-sent. **Remind** uses the server's reminder text; 429 and 409 read "reminded recently" (a 409 also shows the server's reason).
- **Cancel / write off / reverse / payments:** each has an inline confirm with loading and error states; the server's 409 message is shown as is. Write-off needs a reason. Cancelling an invoice with payments is refused by the server (void the payments first); cancel also refreshes time entries and projects, since its time becomes billable again. Every money or status change refreshes the invoice, the lists, the events, and the `activity` and `dashboard` keys (those hooks arrive in steps 11-12).
- **Record payment:** `method` has no `PKR_BANK_TRANSFER` (saved PKR bank transfers become `BANK_TRANSFER`) and adds `CASH`. CARD, CHEQUE and PAYPAL are not offered but still render on old payments. The method is pre-selected from the invoice's first listed payment method. A payment dated today omits `paidAt` (the server stamps now; a local "today" can be in the future in UTC).
- **PDF:** `GET /invoices/{id}/pdf` as a Blob, saved as `<invoiceNumber>.pdf`. The browser Print button is gone. The client-facing `pdfUrl` is the portal's token URL.
- **Document:** `InvoiceDocument` renders the invoice's snapshotted payment methods (a Payoneer `payLink` is a link-out reading "Open Payoneer payment page"), the free-text `paymentInstructions` as an "additional note", and the API's `paymentDisclaimer`. The PKR/USD reference line is still `<Money estimateIn note/>`.
- **Still on the mock store until their steps:** the create flow (step 9), dashboard (11), export (12), the portal (13), the project screens' invoice stats and `settings/method-preview`. The mock invoice seed therefore no longer matches what `/invoices` shows. Mock invoice actions for send, remind, payments, write-off and void were removed from the store.

Backend gaps to raise: no `openapi.json` is checked in (wire types were taken from the server schemas), the list cannot filter by several statuses at once, and `search` matches the invoice number only.
