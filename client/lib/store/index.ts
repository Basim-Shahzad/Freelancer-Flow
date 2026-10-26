"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { daysFromToday, isoDate, localHHMM, nowISO, todayISO } from "../dates";
import { calcTotals, deriveStatus, formatInvoiceNumber } from "../invoice";
import { formatMoney } from "../money";
import {
  seedActivity, seedBusinessLocal, seedExports, seedInvoices, seedPortalProjects, seedTime,
} from "../seed";
import type {
  ActivityEntry, ActivityType, BusinessLocal, DataExport, Invoice, InvoiceEvent, InvoiceEventType,
  InvoiceLine, Payment, PortalProject, TimeEntry, TimerState,
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
  asDraft?: boolean;
}

interface State {
  /** True once persisted state has been loaded in the browser. Gate UI on this to avoid hydration mismatch. */
  hydrated: boolean;
  online: boolean;
  /** Business fields the profile API does not store yet; the rest lives in react-query (see `useBusiness`). */
  businessLocal: BusinessLocal;
  /** Mock projects for the account-less client portal only (`/p/[token]`), until step 13. */
  portalProjects: PortalProject[];
  time: TimeEntry[];
  invoices: Invoice[];
  activity: ActivityEntry[];
  exports: DataExport[];
  timer: TimerState;
}

interface Actions {
  setHydrated(v: boolean): void;
  setOnline(v: boolean): void;
  markSynced(): void;

  updateBusinessLocal(patch: Partial<BusinessLocal>): void;

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

  requestExport(): DataExport;
  finishExport(id: string): void;

  /** Reset to demo data (dev + settings). */
  resetDemo(): void;
}

export type AppStore = State & Actions;

const initial = (): State => ({
  hydrated: false,
  online: true,
  businessLocal: seedBusinessLocal,
  portalProjects: seedPortalProjects,
  time: seedTime,
  invoices: seedInvoices,
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

        updateBusinessLocal: (patch) => set((s) => ({ businessLocal: { ...s.businessLocal, ...patch } })),

        approveMilestone: (projectId, milestoneId) => {
          set((s) => ({ portalProjects: s.portalProjects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "approved", approvedAt: nowISO(), comment: undefined } : m) }) }));
          const p = get().portalProjects.find((x) => x.id === projectId);
          log("project", "Milestone approved by client", p?.name ?? projectId, `“${p?.milestones.find((m) => m.id === milestoneId)?.title}” via share link`);
        },
        requestMilestoneChanges: (projectId, milestoneId, comment) => {
          set((s) => ({ portalProjects: s.portalProjects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "changes_requested", comment } : m) }) }));
          const p = get().portalProjects.find((x) => x.id === projectId);
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
          const number = formatInvoiceNumber(s.businessLocal.invoicePrefix, s.businessLocal.nextInvoiceNumber);
          const inv: Invoice = {
            id: uid("inv"), number, clientId: input.clientId, projectId: input.projectId, currency: input.currency,
            status: input.asDraft ? "draft" : "unpaid", issueDate: input.issueDate ?? todayISO(), dueDate: input.dueDate,
            lines: input.lines, taxPercent: input.taxPercent, discount: input.discount, paymentMethodIds: input.paymentMethodIds,
            note: input.note ?? "", shareToken: token(), payments: [], events: [ev("created", input.asDraft ? "Draft created" : "Invoice created")],
          };
          set((st) => ({
            invoices: [inv, ...st.invoices],
            businessLocal: { ...st.businessLocal, nextInvoiceNumber: st.businessLocal.nextInvoiceNumber + 1 },
            time: st.time.map((t) => (input.timeEntryIds?.includes(t.id) ? { ...t, invoiceId: inv.id } : t)),
          }));
          log("invoice", input.asDraft ? "Draft created" : "Invoice created", number, formatMoney(calcTotals(inv).total, inv.currency));
          return inv;
        },
        updateInvoice: (id, patch) => { patchInvoice(id, (i) => ({ ...i, ...patch, events: [ev("edited", "Invoice edited"), ...i.events] })); },
        sendInvoice: (id, channel) => {
          const inv = get().invoices.find((i) => i.id === id);
          const label = channel === "email" ? "Sent by email" : channel === "whatsapp" ? "Shared on WhatsApp" : "Link copied";
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
      version: 6,
      // v1 -> v2 added optional TimeEntry.startTime; old entries simply lack it.
      // v2 -> v3 moved `business` to the API (`useBusiness`) and dropped `session`; the fields the API lacks are kept in `businessLocal`.
      // v3 -> v4 moved `clients` to the API (`useClients`); the stale mock clients (and their ids) are dropped.
      // v4 -> v5 moved `methods` to the API (`usePaymentMethods`); the stale mock methods (and their ids) are dropped.
      // v5 -> v6 moved `projects` to the API (`useProjects`); only the client-portal mock projects stay, as `portalProjects`.
      migrate: (persisted) => {
        const { business, session: _session, clients: _clients, methods: _methods, projects: _projects, ...rest } = (persisted ?? {}) as Record<string, unknown> & { business?: Partial<BusinessLocal> };
        void _session;
        void _clients;
        void _methods;
        void _projects;
        const businessLocal: BusinessLocal = {
          phone: business?.phone ?? seedBusinessLocal.phone,
          footerNote: business?.footerNote ?? seedBusinessLocal.footerNote,
          invoicePrefix: business?.invoicePrefix ?? seedBusinessLocal.invoicePrefix,
          nextInvoiceNumber: business?.nextInvoiceNumber ?? seedBusinessLocal.nextInvoiceNumber,
          logoName: business?.logoName,
        };
        return { ...rest, businessLocal } as never;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ businessLocal, portalProjects, time, invoices, activity, exports, timer }) => ({ businessLocal, portalProjects, time, invoices, activity, exports, timer }),
    },
  ),
);

export { daysFromToday };
