# Paylancr web — build conventions (read before writing any screen)

Stack: Next.js 15 App Router, React 19, TypeScript (strict), Tailwind CSS v4, shadcn-style primitives (Radix),
lucide-react icons, zustand store (mock data layer), zod + react-hook-form for forms, date-fns, sonner toasts.

## Hard rules
1. **No colour values in components.** Never write hex/rgb/hsl/oklch in `.tsx`. Use semantic Tailwind classes:
   `bg-background bg-surface text-foreground text-muted-foreground border-border border-rule bg-primary text-primary-foreground
   text-primary-ink bg-primary-tint bg-warning-tint text-warning-ink bg-error-tint text-error-ink bg-success-tint text-success-ink bg-hover`.
   Arbitrary `color-mix(in_srgb,var(--x)…)` using tokens is allowed. Gold (`bg-accent`) is ONLY for the Paid moment (StageThread/Paid).
2. **No hardcoded font families or radii.** Use `font-serif` (display + money numerals), default sans, `rounded-lg` (radius token).
3. **Logical properties only** (RTL later): `ms-/me-/ps-/pe-/start-/end-/border-s/border-e/text-start/text-end`, never `ml/mr/pl/pr/left/right`.
4. **Money Rule (UI copy)**: no "Pay now" button anywhere. Clients see payment instructions + copy buttons only.
   Converted figures always labelled "≈ estimate · ref. rate <date>" (use `<Money estimateIn=… note />`).
   Client-facing invoice copy includes: "Paylancr does not process payments. Pay the freelancer directly using the details below." (`NO_PROCESSING` in `lib/fx.ts`).
   Net/estimate figures are labelled "estimate". Never show a status by colour alone — icon + label (use `<StatusChip>`).
5. **Phase 1 only.** Do not build Tax, ESFCA, bank-ready pack, CSV import, Google Drive, pricing/subscription, net-receivable.
6. **States**: every data screen handles loading (skeleton / `loading.tsx`), empty (`<StateBlock kind="empty">` with a CTA), error
   (`error.tsx` + `<StateBlock kind="error">` with retry) and offline (`useAppStore(s=>s.online)`), plus validation errors on forms.
7. **Accessibility**: labelled inputs (`<Field>`), visible focus (global), 44px touch targets (default Button/Input are 44px),
   `aria-current`, `aria-pressed`, `role="alert"` for errors, `<h1>` per page, no information by colour alone, honour reduced motion.
8. **Mobile-first, container-driven layout.** Wrap each page in `<Page>` (it is an `@container`). Use `@2xl:`/`@4xl:` container variants
   (NOT viewport `md:`/`lg:`) for page content so layouts work in any shell. Light on bandwidth: no images, no heavy libs.
9. Server vs client: pages in `app/**/page.tsx` are thin server components (they may read `params`/`searchParams`, which are Promises in
   Next 15: `const { id } = await params`) that render a `"use client"` view from the feature folder. Views read the store and MUST gate on
   hydration: `const hydrated = useHydrated(); if (!hydrated) return <PageSkeleton/>;`.
10. Keep files focused (< ~350 lines). Extract sub-components. No `any`. No `// @ts-ignore`. Handle `undefined` from lookups (`noUncheckedIndexedAccess` is on).

## Layout of the repo
```
app/(marketing)/…  app/(auth)/…  app/(app)/…  app/(portal)/…       route groups (URLs are unaffected)
components/ui/*        primitives (Button, Input/Select/Textarea/InputAffix, Field/Label, Switch, Checkbox/ChoiceRow, RadioGroup/RadioItem,
                       Tabs*, Dialog*, DropdownMenu*, Tooltip*, Tag, Notice, Segmented, Ledger*, Page/PageHeader/Section/Panel/KV/Toolbar/Split,
                       Progress/Pips, Skeleton/PageSkeleton)
components/domain/*    StatusChip, Money, StageThread, StateBlock, CopyButton, InvoiceDocument, PaymentMethodForm
components/shell/*     AppShell (already wraps every `(app)` route), nav, timer, theme toggle…
components/<feature>/* feature components you create (e.g. components/clients/…)
lib/                   types, money, fx, dates, invoice (calcTotals/deriveStatus), payment-methods, seed, selectors, store/index.ts, hooks/*
```

## Key APIs (all already implemented — use, do not reimplement)
- `lib/types.ts` — Client, Project (billingType fixed|hourly|retainer|milestone, milestones[], retainerPeriods[]), TimeEntry, Invoice, InvoiceLine,
  Payment, PaymentMethod, ActivityEntry, BusinessProfile, TimerState, Session. **All amounts are integer minor units** (cents/paisa).
- `lib/money.ts` — `formatAmount(minor,cur)` "1,250.00", `formatMoney` "USD 1,250.00", `parseAmount("1,250.5")→minor|null`, `formatDuration(min)` "1h 30m",
  `formatHours`, `parseDuration("1.5"|"1:30"|"90m")→min|null`. PKR shows no decimals.
- `lib/fx.ts` — `convertMinor`, `FX_REF_DATE`, `ESTIMATE_LABEL`, `FX_DISCLAIMER`, `NO_PROCESSING`.
- `lib/dates.ts` — `fmtDate` "05 Oct 2026", `fmtDay` "Mon 05 Oct", `fmtDateTime`, `todayISO`, `daysFromToday(n)`, `daysBetween(a,b)`, `addDays`, `isoDate`.
- `lib/invoice.ts` — `calcTotals(inv)`, `deriveStatus(inv)` (use for DISPLAY status; stored `status` is only draft/unpaid/written_off/void), `daysOverdue`, `isLive`, `lineAmount`.
- `lib/payment-methods.ts` — `METHOD_KINDS`, `BANK_SCHEMES`, `fieldsFor(kind,scheme)`, `methodTitle`, `methodSummary`, `maskValue`.
- `lib/selectors.ts` — `toInvoiceView(inv, clients, projects)` (adds display status, totals, client, project), `outstandingByCurrency`, `clientName`, `projectName`.
- `lib/store/index.ts` — `useAppStore(selector)`; select narrow slices (primitive/stable values) to avoid re-render loops; never select a freshly-built array/object
  without `useShallow` (from `zustand/react/shallow`) or `useMemo` over raw slices. Actions: see the `Actions` interface (addClient, updateProject, createInvoice, sendInvoice,
  remindInvoice, recordPayment, reversePayment, writeOff, reverseWriteOff, voidInvoice, approveMilestone, requestMilestoneChanges, upsertMethod, moveMethod, setDefaultMethod,
  toggleMethod, removeMethod, addTime, updateTime, deleteTime, bulkUpdateTime, resolveConflict, startTimer/stopTimer, requestExport/finishExport, signUp/logIn/logOut/completeOnboarding…).
- `lib/hooks/*` — `useHydrated`, `useIsOnline`, `useElapsed`/`formatClock`, `useCopy` (+ `<CopyButton>`).
- Toasts: `import { toast } from "sonner"`.

## Design source
Each screen has a reference design (HTML-ish "dc" files) in
`/tmp/claude-0/-home-claude/e53b921c-7bf1-5bf3-aaac-b6a8ceb3dbc0/scratchpad/pl/project/` (e.g. `Page_Clients.dc.html`, plus `paylancr.css` for exact styles).
Port the **layout, copy, hierarchy, states and variants** faithfully, but build real React: real forms with validation, working filters/sorting, real navigation between routes.
In the design files the `Screen_*`/`Phone_*`/`Page_*` wrappers are just review artboards — implement only the `Page_*`/content (the shell already exists).
Design "variants" (e.g. loading/empty/error/offline) become real runtime states.

## Verification (do NOT run `next build` or `next dev` — other builders share this folder)
Run: `npx tsc --noEmit` and `npx eslint <your files/dirs>` until clean. Add vitest tests (`*.test.ts[x]`) for non-trivial pure logic you write. Run only your tests: `npx vitest run <path>`.
Do not modify shared files (lib/*, components/ui|domain|shell, globals.css, docs). If you truly need a change there, make it additive (new export/optional prop), keep existing behaviour,
and list it in your final report. Never delete or rename existing exports.

## Reference-UI port (round 2)
- Buttons and filter chips are pills (`rounded-full`). `Segmented` renders pill chips.
- Cards: `Card` / `CardHead title sub action` / `CardBody` / `CardFoot` and `KpiStrip` in `components/ui/section.tsx` (14px radius, hairline border, white surface). Use for every new panel.
- Keep our fonts (Hanken + Newsreader), spine sidebar, tokens only, Money Rule, container queries, logical properties.
- Reference UI is at /mnt/user-data/uploads/paylancer-ui (html/js/css) with renders in the scratchpad `ref/*.png`.
