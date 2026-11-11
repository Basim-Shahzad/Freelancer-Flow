/** How long cached data counts as fresh, per kind of data. Portal queries are separate (`Infinity`, never refetched). */
export const STALE = {
  /** Reference data that moves daily (FX rates). */
  REFERENCE: 6 * 60 * 60_000,
  /** Rarely changing records: profile, clients, projects, payment methods, session. */
  STABLE: 5 * 60_000,
  /** Money/status data that changes under you: dashboard, activity, invoices, milestones. */
  LIVE: 30_000,
  /** Always revalidate (time entries). */
  ALWAYS_FRESH: 0,
} as const;
