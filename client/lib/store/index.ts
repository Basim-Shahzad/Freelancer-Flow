"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { daysFromToday, isoDate, localHHMM, nowISO, todayISO } from "../dates";
import { calcTotals, deriveStatus, formatInvoiceNumber } from "../invoice";
import { formatMoney } from "../money";
import { methodTitle } from "../payment-methods";
import {
  seedActivity, seedBusiness, seedClients, seedExports, seedInvoices, seedMethods, seedProjects, seedTime,
} from "../seed";
import type {
  ActivityEntry, ActivityType, BusinessProfile, Client, DataExport, Invoice, InvoiceEvent, InvoiceEventType,
  InvoiceLine, Payment, PaymentMethod, Project, Session, TimeEntry, TimerState,
} from "../types";

export const uid = (prefix: string) =>
  `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 10)}`;
const token = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12);

export interface NewInvoiceInput {
  clientId: string;
  projectId?: string;
  currency: Invoice["currency"];
  issueDate?: string;
  dueDate: string;
  lines: InvoiceLine[];
  taxPercent: number;
  discount: number;
  paymentMethodIds: string[];
  note?: string;
  /** Time entry ids to mark invoiced. */
  timeEntryIds?: string[];
  /** Milestone / retainer references to mark invoiced. */
  milestoneIds?: string[];
  retainerPeriodIds?: string[];
  asDraft?: boolean;
}

interface State {
  /** True once persisted state has been loaded in the browser. Gate UI on this to avoid hydration mismatch. */
  hydrated: boolean;
  online: boolean;
  session: Session;
  business: BusinessProfile;
  clients: Client[];
  projects: Project[];
  time: TimeEntry[];
  invoices: Invoice[];
  methods: PaymentMethod[];
  activity: ActivityEntry[];
  exports: DataExport[];
  timer: TimerState;
}

interface Actions {
  setHydrated(v: boolean): void;
  setOnline(v: boolean): void;
  markSynced(): void;

  /** Onboarding is not tracked by the backend yet, so it is a local flag. */
  setOnboarded(v: boolean): void;
  completeOnboarding(input: { business: Partial<BusinessProfile>; client?: Omit<Client, "id" | "createdAt">; method?: Omit<PaymentMethod, "id" | "isDefault" | "enabled"> }): void;

  updateBusiness(patch: Partial<BusinessProfile>): void;

  addClient(c: Omit<Client, "id" | "createdAt">): Client;
  updateClient(id: string, patch: Partial<Client>): void;
  deleteClient(id: string): void;

  addProject(p: Omit<Project, "id" | "shareToken">): Project;
  updateProject(id: string, patch: Partial<Project>): void;
  deleteProject(id: string): void;
  /** Client portal actions (called from the no-login share link). */
  approveMilestone(projectId: string, milestoneId: string): void;
  requestMilestoneChanges(projectId: string, milestoneId: string, comment: string): void;

  addTime(t: Omit<TimeEntry, "id" | "updatedAt" | "unsynced">): TimeEntry;
  updateTime(id: string, patch: Partial<TimeEntry>): void;
  deleteTime(ids: string[]): void;
  bulkUpdateTime(ids: string[], patch: Partial<Pick<TimeEntry, "projectId" | "billable">>): void;
  resolveConflict(id: string, keep: "device" | "server" | "both"): void;
  startTimer(input?: { projectId?: string; description?: string }): void;
  updateTimer(patch: Partial<Pick<TimerState, "projectId" | "description">>): void;
  stopTimer(): TimeEntry | null;

  createInvoice(input: NewInvoiceInput): Invoice;
  updateInvoice(id: string, patch: Partial<Invoice>): void;
  sendInvoice(id: string, channel: "email" | "whatsapp" | "link"): void;
  markViewed(id: string): void;
  remindInvoice(id: string, channel: "email" | "whatsapp", tone: "polite" | "firm" | "final"): void;
  recordPayment(id: string, p: Omit<Payment, "id" | "recordedAt">): void;
  reversePayment(invoiceId: string, paymentId: string): void;
  writeOff(id: string, reason?: string): void;
  reverseWriteOff(id: string): void;
  voidInvoice(id: string, reason?: string): void;

  upsertMethod(m: Omit<PaymentMethod, "id"> & { id?: string }): PaymentMethod;
  removeMethod(id: string): void;
  moveMethod(id: string, dir: -1 | 1): void;
  setDefaultMethod(id: string): void;
  toggleMethod(id: string): void;

  requestExport(): DataExport;
  finishExport(id: string): void;

  /** Reset to demo data (dev + settings). */
  resetDemo(): void;
}

export type AppStore = State & Actions;

const initial = (): State => ({
  hydrated: false,
  online: true,
  session: { onboarded: true },
  business: seedBusiness,
  clients: seedClients,
  projects: seedProjects,
  time: seedTime,
  invoices: seedInvoices,
  methods: seedMethods,
  activity: seedActivity,
  exports: seedExports,
  timer: { running: true, projectId: "p-harbor", description: "Checkout flow QA", startedAt: new Date(Date.now() - 84 * 60_000).toISOString() },
});

const ev = (type: InvoiceEventType, label: string): InvoiceEvent => ({ id: uid("ev"), type, at: nowISO(), label });

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
      const log = (type: ActivityType, action: string, record: string, detail: string) =>
        set((s) => ({ activity: [{ id: uid("a"), at: nowISO(), type, action, record, detail }, ...s.activity].slice(0, 500) }));

      const patchInvoice = (id: string, fn: (inv: Invoice) => Invoice) =>
        set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? fn(i) : i)) }));

      return {
        ...initial(),

        setHydrated: (hydrated) => set({ hydrated }),
        setOnline: (online) => set({ online }),
        markSynced: () => set((s) => ({ time: s.time.map((t) => (t.unsynced ? { ...t, unsynced: false } : t)) })),

        setOnboarded: (v) => set({ session: { onboarded: v } }),
        completeOnboarding: ({ business, client, method }) => {
          set((s) => ({ business: { ...s.business, ...business }, session: { ...s.session, onboarded: true } }));
          if (client) get().addClient(client);
          if (method) get().upsertMethod({ ...method, enabled: true, isDefault: get().methods.length === 0 });
        },

        updateBusiness: (patch) => { set((s) => ({ business: { ...s.business, ...patch } })); log("settings", "Business profile updated", "Settings", Object.keys(patch).join(", ")); },

        addClient: (c) => {
          const client: Client = { ...c, id: uid("c"), createdAt: nowISO() };
          set((s) => ({ clients: [client, ...s.clients] }));
          log("client", "Client added", client.name, client.email);
          return client;
        },
        updateClient: (id, patch) => { set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })); log("client", "Client updated", get().clients.find((c) => c.id === id)?.name ?? id, Object.keys(patch).join(", ")); },
        deleteClient: (id) => {
          const name = get().clients.find((c) => c.id === id)?.name ?? id;
          set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
          log("client", "Client deleted", name, "");
        },

        addProject: (p) => {
          const project: Project = { ...p, id: uid("p"), shareToken: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 16)}-${token().slice(0, 4)}` };
          set((s) => ({ projects: [project, ...s.projects] }));
          log("project", "Project created", project.name, project.billingType);
          return project;
        },
        updateProject: (id, patch) => { set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })); log("project", "Project updated", get().projects.find((p) => p.id === id)?.name ?? id, Object.keys(patch).join(", ")); },
        deleteProject: (id) => {
          const name = get().projects.find((p) => p.id === id)?.name ?? id;
          set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
          log("project", "Project deleted", name, "");
        },
        approveMilestone: (projectId, milestoneId) => {
          set((s) => ({ projects: s.projects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "approved", approvedAt: nowISO(), comment: undefined } : m) }) }));
          const p = get().projects.find((x) => x.id === projectId);
          log("project", "Milestone approved by client", p?.name ?? projectId, `“${p?.milestones.find((m) => m.id === milestoneId)?.title}” via share link`);
        },
        requestMilestoneChanges: (projectId, milestoneId, comment) => {
          set((s) => ({ projects: s.projects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "changes_requested", comment } : m) }) }));
          const p = get().projects.find((x) => x.id === projectId);
          log("project", "Changes requested by client", p?.name ?? projectId, comment.slice(0, 80));
        },

        addTime: (t) => {
          const entry: TimeEntry = { ...t, id: uid("t"), updatedAt: nowISO(), unsynced: !get().online };
          set((s) => ({ time: [entry, ...s.time] }));
          return entry;
        },
        updateTime: (id, patch) => set((s) => ({ time: s.time.map((t) => (t.id === id && !t.invoiceId ? { ...t, ...patch, updatedAt: nowISO(), unsynced: !s.online } : t)) })),
        deleteTime: (ids) => set((s) => ({ time: s.time.filter((t) => !ids.includes(t.id) || t.invoiceId) })),
        bulkUpdateTime: (ids, patch) => set((s) => ({ time: s.time.map((t) => (ids.includes(t.id) && !t.invoiceId ? { ...t, ...patch, updatedAt: nowISO(), unsynced: !s.online } : t)) })),
        resolveConflict: (id, keep) => set((s) => ({
          time: keep === "both"
            ? s.time.flatMap((t) => (t.id === id ? [{ ...t, unsynced: false }, { ...t, id: uid("t"), unsynced: false, description: `${t.description} (server copy)` }] : [t]))
            : s.time.map((t) => (t.id === id ? { ...t, unsynced: false } : t)),
        })),

        startTimer: (input) => set((s) => ({ timer: { running: true, projectId: input?.projectId ?? s.timer.projectId, description: input?.description ?? s.timer.description, startedAt: nowISO() } })),
        updateTimer: (patch) => set((s) => ({ timer: { ...s.timer, ...patch } })),
        stopTimer: () => {
          const { timer, online } = get();
          if (!timer.running || !timer.startedAt) return null;
          const minutes = Math.max(1, Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 60000));
          const entry: TimeEntry = { id: uid("t"), projectId: timer.projectId, description: timer.description || "Untitled", date: todayISO(), startTime: isoDate(new Date(timer.startedAt)) === todayISO() ? localHHMM(new Date(timer.startedAt)) : "00:00", minutes, billable: true, updatedAt: nowISO(), unsynced: !online };
          set((s) => ({ time: [entry, ...s.time], timer: { running: false, description: "", projectId: s.timer.projectId } }));
          return entry;
        },

        createInvoice: (input) => {
          const s = get();
          const number = formatInvoiceNumber(s.business.invoicePrefix, s.business.nextInvoiceNumber);
          const inv: Invoice = {
            id: uid("inv"), number, clientId: input.clientId, projectId: input.projectId, currency: input.currency,
            status: input.asDraft ? "draft" : "unpaid", issueDate: input.issueDate ?? todayISO(), dueDate: input.dueDate,
            lines: input.lines, taxPercent: input.taxPercent, discount: input.discount, paymentMethodIds: input.paymentMethodIds,
            note: input.note ?? "", shareToken: token(), payments: [], events: [ev("created", input.asDraft ? "Draft created" : "Invoice created")],
          };
          set((st) => ({
            invoices: [inv, ...st.invoices],
            business: { ...st.business, nextInvoiceNumber: st.business.nextInvoiceNumber + 1 },
            time: st.time.map((t) => (input.timeEntryIds?.includes(t.id) ? { ...t, invoiceId: inv.id } : t)),
            projects: st.projects.map((p) => p.id !== input.projectId ? p : {
              ...p,
              milestones: p.milestones.map((m) => (input.milestoneIds?.includes(m.id) ? { ...m, invoiceId: inv.id } : m)),
              retainerPeriods: p.retainerPeriods.map((r) => (input.retainerPeriodIds?.includes(r.id) ? { ...r, invoiceId: inv.id } : r)),
            }),
          }));
          log("invoice", input.asDraft ? "Draft created" : "Invoice created", number, formatMoney(calcTotals(inv).total, inv.currency));
          return inv;
        },
        updateInvoice: (id, patch) => { patchInvoice(id, (i) => ({ ...i, ...patch, events: [ev("edited", "Invoice edited"), ...i.events] })); },
        sendInvoice: (id, channel) => {
          const inv = get().invoices.find((i) => i.id === id);
          const client = get().clients.find((c) => c.id === inv?.clientId);
          const label = channel === "email" ? `Sent by email to ${client?.email ?? "client"}` : channel === "whatsapp" ? "Shared on WhatsApp" : "Link copied";
          patchInvoice(id, (i) => ({ ...i, status: i.status === "draft" && channel !== "link" ? "unpaid" : i.status, events: [ev("sent", label), ...i.events] }));
          log("invoice", channel === "link" ? "Share link copied" : "Invoice sent", inv?.number ?? id, label);
        },
        markViewed: (id) => patchInvoice(id, (i) => (i.events.some((e) => e.type === "viewed") ? i : { ...i, events: [ev("viewed", "Viewed by client"), ...i.events] })),
        remindInvoice: (id, channel, tone) => {
          const inv = get().invoices.find((i) => i.id === id);
          const label = `Reminder sent ${channel === "email" ? "by email" : "on WhatsApp"} (${tone})`;
          patchInvoice(id, (i) => ({ ...i, events: [ev("reminder", label), ...i.events] }));
          log("invoice", "Reminder sent", inv?.number ?? id, label);
        },
        recordPayment: (id, p) => {
          const payment: Payment = { ...p, id: uid("pay"), recordedAt: nowISO() };
          const before = get().invoices.find((i) => i.id === id);
          patchInvoice(id, (i) => {
            const next = { ...i, payments: [...i.payments, payment] };
            const extra: InvoiceEvent[] = [ev("payment", `Payment recorded · ${formatMoney(p.amount, i.currency)}`)];
            if (deriveStatus(next) === "paid") extra.unshift(ev("paid", "Marked paid"));
            return { ...next, events: [...extra, ...i.events] };
          });
          log("payment", "Payment recorded", before?.number ?? id, `${before ? formatMoney(p.amount, before.currency) : ""} · ${p.method}${p.reference ? ` · ref ${p.reference}` : ""}`);
          const after = get().invoices.find((i) => i.id === id);
          if (after && deriveStatus(after) === "paid") log("invoice", "Status changed to paid", after.number, "Fully paid");
        },
        reversePayment: (invoiceId, paymentId) => {
          patchInvoice(invoiceId, (i) => ({ ...i, payments: i.payments.filter((p) => p.id !== paymentId), events: [ev("payment_reversed", "Payment reversed"), ...i.events] }));
          log("payment", "Payment reversed", get().invoices.find((i) => i.id === invoiceId)?.number ?? invoiceId, "");
        },
        writeOff: (id, reason) => {
          const inv = get().invoices.find((i) => i.id === id);
          const amount = inv ? calcTotals(inv).balance : 0;
          patchInvoice(id, (i) => ({ ...i, status: "written_off", writtenOffAt: nowISO(), events: [ev("written_off", `Written off · ${formatMoney(amount, i.currency)}${reason ? ` · reason: ${reason}` : ""}`), ...i.events] }));
          log("invoice", "Written off", inv?.number ?? id, `${inv ? formatMoney(amount, inv.currency) : ""}${reason ? ` · reason: ${reason}` : ""}`);
        },
        reverseWriteOff: (id) => {
          patchInvoice(id, (i) => ({ ...i, status: "unpaid", writtenOffAt: undefined, events: [ev("write_off_reversed", "Write-off reversed"), ...i.events] }));
          log("invoice", "Write-off reversed", get().invoices.find((i) => i.id === id)?.number ?? id, "");
        },
        voidInvoice: (id, reason) => {
          patchInvoice(id, (i) => ({ ...i, status: "void", events: [ev("void", `Voided${reason ? ` · reason: ${reason}` : ""}`), ...i.events] }));
          log("invoice", "Invoice voided", get().invoices.find((i) => i.id === id)?.number ?? id, reason ?? "");
        },

        upsertMethod: (m) => {
          const existing = m.id ? get().methods.find((x) => x.id === m.id) : undefined;
          const method: PaymentMethod = { ...m, id: m.id ?? uid("pm") } as PaymentMethod;
          set((s) => ({ methods: existing ? s.methods.map((x) => (x.id === method.id ? method : x)) : [...s.methods, { ...method, isDefault: s.methods.length === 0 ? true : method.isDefault }] }));
          log("settings", existing ? "Payment method updated" : "Payment method added", "Settings", methodTitle(method));
          return method;
        },
        removeMethod: (id) => {
          const m = get().methods.find((x) => x.id === id);
          set((s) => {
            const rest = s.methods.filter((x) => x.id !== id);
            if (m?.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true };
            return { methods: rest };
          });
          if (m) log("settings", "Payment method removed", "Settings", methodTitle(m));
        },
        moveMethod: (id, dir) => {
          set((s) => {
            const i = s.methods.findIndex((m) => m.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= s.methods.length) return s;
            const next = s.methods.slice();
            const a = next[i]; const b = next[j];
            if (!a || !b) return s;
            next[i] = b; next[j] = a;
            return { methods: next };
          });
          log("settings", "Payment method reordered", "Settings", methodTitle(get().methods.find((m) => m.id === id) ?? ({ kind: "other", fields: {} } as PaymentMethod)));
        },
        setDefaultMethod: (id) => set((s) => ({ methods: s.methods.map((m) => ({ ...m, isDefault: m.id === id })) })),
        toggleMethod: (id) => set((s) => ({ methods: s.methods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)) })),

        requestExport: () => {
          const x: DataExport = { id: uid("x"), requestedAt: nowISO(), status: "preparing", fileName: `paylancr-export-${todayISO()}.zip`, sizeLabel: "4.2 MB" };
          set((s) => ({ exports: [x, ...s.exports] }));
          log("settings", "Data export requested", "Settings", x.fileName);
          return x;
        },
        finishExport: (id) => set((s) => ({ exports: s.exports.map((e) => (e.id === id ? { ...e, status: "ready" } : e)) })),

        resetDemo: () => set({ ...initial(), hydrated: true }),
      };
    },
    {
      name: "paylancr-v1",
      version: 2,
      // v1 -> v2 added optional TimeEntry.startTime; nothing to rewrite, old entries simply lack it.
      migrate: (persisted) => persisted as never,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ session, business, clients, projects, time, invoices, methods, activity, exports, timer }) => ({ session, business, clients, projects, time, invoices, methods, activity, exports, timer }),
    },
  ),
);

export { daysFromToday };
