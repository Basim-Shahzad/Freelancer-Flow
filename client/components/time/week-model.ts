import { clientHue } from "@/lib/client-hue";
import { minutesOfHHMM } from "@/lib/dates";
import type { Client, Invoice, Project, TimerState } from "@/lib/types";
import type { TimeEntry } from "@/lib/types";
import {
  classifyAll, hhmm, layoutDay, shortDuration, STATE_LABEL, weekDays,
  type BillState, type ClassifiedEntry, type RawBlock,
} from "./week-logic";

/** A positioned, fully described block in the week grid / day agenda. */
export interface BlockItem {
  id: string;
  /** Set for stored entries; the running timer has none. */
  entry?: TimeEntry;
  state: BillState;
  projectName: string;
  clientName: string;
  description: string;
  hue: string;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
  minutes: number;
  /** Invoice the entry is locked to, if any. */
  invoice?: { id: string; number: string };
  unsynced: boolean;
  label: string;
}

export interface DayModel { date: string; blocks: BlockItem[]; minutes: number }

interface Ctx { projects: Project[]; clients: Client[]; invoices: Invoice[]; timer: TimerState; nowMs: number; today: string }

const minuteOfDay = (ms: number): number => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };

/** Seven day models for a week, with stacked/laid-out blocks and the running timer on today. */
export function buildWeek(weekStart: string, entries: TimeEntry[], ctx: Ctx): { days: DayModel[]; classified: ClassifiedEntry[] } {
  const dates = weekDays(weekStart);
  const inWeek = entries.filter((e) => e.date >= (dates[0] ?? "") && e.date <= (dates[6] ?? ""));
  const classified = classifyAll(inWeek, ctx.projects, ctx.invoices, ctx.today);
  const clientIds = ctx.clients.map((c) => c.id);
  const iById = new Map(ctx.invoices.map((i) => [i.id, i]));
  const cById = new Map(ctx.clients.map((c) => [c.id, c]));
  const pById = new Map(ctx.projects.map((p) => [p.id, p]));
  const timerOn = ctx.timer.running && Boolean(ctx.timer.startedAt);

  const days = dates.map((date): DayModel => {
    const items = classified.filter((c) => c.entry.date === date);
    const raw: RawBlock[] = items.map((c) => ({ id: c.entry.id, minutes: c.entry.minutes, order: c.entry.updatedAt, startMin: minutesOfHHMM(c.entry.startTime) }));
    let runningMeta: { start: number; minutes: number } | undefined;
    if (timerOn && date === ctx.today && ctx.timer.startedAt) {
      const started = new Date(ctx.timer.startedAt).getTime();
      const sameDay = new Date(started).toDateString() === new Date(ctx.nowMs).toDateString();
      const start = sameDay ? minuteOfDay(started) : 0;
      const minutes = Math.max(1, Math.floor((ctx.nowMs - started) / 60_000));
      const visible = sameDay ? minutes : Math.max(1, minuteOfDay(ctx.nowMs));
      runningMeta = { start, minutes: visible };
      raw.push({ id: "__running", minutes: visible, startMin: start });
    }
    const laid = new Map(layoutDay(raw).map((b) => [b.id, b]));
    const blocks: BlockItem[] = [];
    for (const c of items) {
      const b = laid.get(c.entry.id);
      if (!b) continue;
      const project = c.project;
      const client = project ? cById.get(project.clientId) : undefined;
      const invoice = c.entry.invoiceId ? iById.get(c.entry.invoiceId) : undefined;
      const projectName = project?.name ?? "Internal";
      const clientName = client?.name ?? "No client";
      blocks.push({
        id: c.entry.id, entry: c.entry, state: c.state, projectName, clientName, description: c.entry.description,
        hue: project ? clientHue(project.clientId, clientIds) : "var(--hue-6)",
        startMin: b.startMin, endMin: b.endMin, lane: b.lane, lanes: b.lanes, minutes: c.entry.minutes,
        invoice: invoice ? { id: invoice.id, number: invoice.number } : undefined, unsynced: Boolean(c.entry.unsynced),
        label: `${projectName}, ${clientName}, ${hhmm(b.startMin)}–${hhmm(b.endMin)}, ${shortDuration(c.entry.minutes)}, ${STATE_LABEL[c.state]}${invoice ? ` on ${invoice.number}` : ""}`,
      });
    }
    if (runningMeta) {
      const b = laid.get("__running");
      const project = ctx.timer.projectId ? pById.get(ctx.timer.projectId) : undefined;
      const client = project ? cById.get(project.clientId) : undefined;
      if (b) {
        const projectName = project?.name ?? "Internal";
        const clientName = client?.name ?? "No client";
        blocks.push({
          id: "__running", state: "live", projectName, clientName, description: ctx.timer.description || "Untitled",
          hue: project ? clientHue(project.clientId, clientIds) : "var(--hue-6)",
          startMin: b.startMin, endMin: b.endMin, lane: b.lane, lanes: b.lanes, minutes: runningMeta.minutes, unsynced: false,
          label: `${projectName}, ${clientName}, started ${hhmm(b.startMin)}, ${shortDuration(runningMeta.minutes)} so far, running`,
        });
      }
    }
    blocks.sort((a, b) => a.startMin - b.startMin);
    return { date, blocks, minutes: blocks.reduce((s, b) => s + b.minutes, 0) };
  });
  return { days, classified };
}
