"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { daysFromToday, nowISO } from "../dates";
import {
  seedBusinessLocal, seedInvoices, seedPortalProjects, seedTime,
} from "../seed";
import type {
  BusinessLocal, Invoice, InvoiceEvent, InvoiceEventType,
  PortalProject, TimeEntry,
} from "../types";

export const uid = (prefix: string) =>
  `${prefix}-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 10)}`;

interface State {
  /** True once persisted state has been loaded in the browser. Gate UI on this to avoid hydration mismatch. */
  hydrated: boolean;
  online: boolean;
  /** Business fields the profile API does not store yet; the rest lives in react-query (see `useBusiness`). */
  businessLocal: BusinessLocal;
  /** Mock projects for the account-less client portal only (`/p/[token]`), until step 13. */
  portalProjects: PortalProject[];
  /**
   * Read-only mock time entries. Time tracking runs on the API (`lib/hooks/time-entries`); this array only feeds
   * screens not migrated yet (dashboard: step 11, export: step 12), which delete it.
   */
  time: TimeEntry[];
  invoices: Invoice[];
}

interface Actions {
  setHydrated(v: boolean): void;
  setOnline(v: boolean): void;

  updateBusinessLocal(patch: Partial<BusinessLocal>): void;

  /** Client portal actions (called from the no-login share link). */
  approveMilestone(projectId: string, milestoneId: string): void;
  requestMilestoneChanges(projectId: string, milestoneId: string, comment: string): void;

  markViewed(id: string): void;

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
});

const ev = (type: InvoiceEventType, label: string): InvoiceEvent => ({ id: uid("ev"), type, at: nowISO(), label });

export const useAppStore = create<AppStore>()(
  persist(
    (set) => {
      const patchInvoice = (id: string, fn: (inv: Invoice) => Invoice) =>
        set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? fn(i) : i)) }));

      return {
        ...initial(),

        setHydrated: (hydrated) => set({ hydrated }),
        setOnline: (online) => set({ online }),

        updateBusinessLocal: (patch) => set((s) => ({ businessLocal: { ...s.businessLocal, ...patch } })),

        approveMilestone: (projectId, milestoneId) => {
          set((s) => ({ portalProjects: s.portalProjects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "approved", approvedAt: nowISO(), comment: undefined } : m) }) }));
        },
        requestMilestoneChanges: (projectId, milestoneId, comment) => {
          set((s) => ({ portalProjects: s.portalProjects.map((p) => p.id !== projectId ? p : { ...p, milestones: p.milestones.map((m) => m.id === milestoneId ? { ...m, status: "changes_requested", comment } : m) }) }));
        },

        markViewed: (id) => patchInvoice(id, (i) => (i.events.some((e) => e.type === "viewed") ? i : { ...i, events: [ev("viewed", "Viewed by client"), ...i.events] })),
        // Creating, editing, sending, reminding, payments, write-off and cancelling run on the API (`lib/hooks/invoices`);
        // the remaining mock invoices feed the dashboard/export/portal until steps 11-14.


        resetDemo: () => set({ ...initial(), hydrated: true }),
      };
    },
    {
      name: "paylancr-v1",
      version: 7,
      // v1 -> v2 added optional TimeEntry.startTime; old entries simply lack it.
      // v2 -> v3 moved `business` to the API (`useBusiness`) and dropped `session`; the fields the API lacks are kept in `businessLocal`.
      // v3 -> v4 moved `clients` to the API (`useClients`); the stale mock clients (and their ids) are dropped.
      // v4 -> v5 moved `methods` to the API (`usePaymentMethods`); the stale mock methods (and their ids) are dropped.
      // v5 -> v6 moved `projects` to the API (`useProjects`); only the client-portal mock projects stay, as `portalProjects`.
      // v6 -> v7 moved the timer and time actions to the API (`useRunningTimer`, ...): `timer` is dropped, and mock entries
      //          that carried an `invoiceId` now carry `isInvoiced`.
      migrate: (persisted) => {
        const { business, session: _session, clients: _clients, methods: _methods, projects: _projects, timer: _timer, time, ...rest } = (persisted ?? {}) as Record<string, unknown> & { business?: Partial<BusinessLocal>; time?: (TimeEntry & { invoiceId?: string })[] };
        void _session;
        void _clients;
        void _methods;
        void _projects;
        void _timer;
        const businessLocal: BusinessLocal = {
          phone: business?.phone ?? seedBusinessLocal.phone,
          footerNote: business?.footerNote ?? seedBusinessLocal.footerNote,
          invoicePrefix: business?.invoicePrefix ?? seedBusinessLocal.invoicePrefix,
          nextInvoiceNumber: business?.nextInvoiceNumber ?? seedBusinessLocal.nextInvoiceNumber,
          logoName: business?.logoName,
        };
        const migratedTime = time?.map(({ invoiceId, ...t }) => ({ ...t, isInvoiced: t.isInvoiced ?? Boolean(invoiceId) }));
        return { ...rest, businessLocal, ...(migratedTime ? { time: migratedTime } : {}) } as never;
      },
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ businessLocal, portalProjects, time, invoices }) => ({ businessLocal, portalProjects, time, invoices }),
    },
  ),
);

export { daysFromToday };
