import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

export const isoDate = (d: Date) => format(d, "yyyy-MM-dd");
export const todayISO = () => isoDate(new Date());
/** Local "HH:MM" of a date. */
export const localHHMM = (d: Date) => format(d, "HH:mm");
/** Minutes from midnight for "HH:MM"; undefined when missing or malformed. */
export function minutesOfHHMM(t: string | undefined): number | undefined {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}
export const nowISO = () => new Date().toISOString();

export function parse(d: string): Date {
  const p = parseISO(d);
  return isValid(p) ? p : new Date(NaN);
}

/** "05 Oct 2026" */
export function fmtDate(d: string | undefined): string {
  if (!d) return "—";
  const p = parse(d);
  return isValid(p) ? format(p, "dd MMM yyyy") : "—";
}

/** "Mon 05 Oct" */
export function fmtDay(d: string): string {
  const p = parse(d);
  return isValid(p) ? format(p, "EEE dd MMM") : "—";
}

/** "05 Oct 2026 · 10:14" */
export function fmtDateTime(d: string): string {
  const p = parse(d);
  return isValid(p) ? format(p, "dd MMM yyyy · HH:mm") : "—";
}

export function ago(d: string): string {
  const p = parse(d);
  return isValid(p) ? `${formatDistanceToNowStrict(p)} ago` : "—";
}

export const daysFromToday = (n: number) => isoDate(addDays(new Date(), n));
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parse(a), parse(b));
export { addDays, format, isValid };
