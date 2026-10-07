import { isoDate, minutesOfHHMM } from "@/lib/dates";

/** Day strip: 08:00-20:00 in 15-minute slots. Entries carry no start time, so it is derived (see entrySegments). */
export const DAY_START = 8 * 60;
export const DAY_END = 20 * 60;
export const SLOT_MIN = 15;
export const SLOT_COUNT = (DAY_END - DAY_START) / SLOT_MIN;

export interface Segment { startMin: number; endMin: number; key?: string; live?: boolean }
export type Slot = { kind: "entry"; key?: string } | { kind: "live" } | null;

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Paint segments into slots. Later segments overwrite earlier ones; live always wins. Anything outside the window is clipped. */
export function bucketDayStrip(segments: Segment[]): Slot[] {
  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, () => null);
  const ordered = [...segments].sort((a, b) => Number(!!a.live) - Number(!!b.live));
  for (const seg of ordered) {
    const s = Math.max(seg.startMin, DAY_START);
    const e = Math.min(seg.endMin, DAY_END);
    if (e <= s) continue;
    const first = Math.floor((s - DAY_START) / SLOT_MIN);
    const last = Math.max(first, Math.ceil((e - DAY_START) / SLOT_MIN) - 1);
    for (let i = first; i <= last && i < SLOT_COUNT; i += 1) slots[i] = seg.live ? { kind: "live" } : { kind: "entry", key: seg.key };
  }
  return slots;
}

/**
 * Entries with a startTime are placed exactly (start to start + minutes). Legacy entries have only a date and a duration: a timer-saved entry has `updatedAt` = when it was stopped, so it
 * ends there. Entries not saved today (typed in for today, edited later) are laid end to end from 08:00 instead.
 * Overlaps are pushed later so every entry keeps its full length.
 */
export function entrySegments(entries: { minutes: number; updatedAt: string; startTime?: string; key?: string }[], today: string): Segment[] {
  const placed: Segment[] = [];
  const exact: Segment[] = [];
  const loose: { minutes: number; key?: string }[] = [];
  for (const e of entries) {
    const start = minutesOfHHMM(e.startTime);
    if (start !== undefined) {
      exact.push({ startMin: start, endMin: Math.min(start + e.minutes, 1440), key: e.key });
      continue;
    }
    const at = new Date(e.updatedAt);
    if (!Number.isNaN(at.getTime()) && isoDate(at) === today) {
      const end = minutesOfDay(at);
      placed.push({ startMin: end - e.minutes, endMin: end, key: e.key });
    } else loose.push(e);
  }
  let cursor = DAY_START;
  for (const e of loose) { placed.push({ startMin: cursor, endMin: cursor + e.minutes, key: e.key }); cursor += e.minutes; }
  placed.sort((a, b) => a.startMin - b.startMin);
  let prevEnd = -Infinity;
  for (const seg of placed) {
    if (seg.startMin < prevEnd) { const shift = prevEnd - seg.startMin; seg.startMin += shift; seg.endMin += shift; }
    prevEnd = seg.endMin;
  }
  // Real start times are never moved.
  return [...placed, ...exact].sort((a, b) => a.startMin - b.startMin);
}

/** The running span, from its start (or midnight if it began on an earlier day) to `now`. */
export function liveSegment(startedAt: string, now: Date, today: string): Segment | null {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const startMin = isoDate(start) === today ? minutesOfDay(start) : 0;
  return { startMin, endMin: Math.max(minutesOfDay(now), startMin + 1), live: true };
}
