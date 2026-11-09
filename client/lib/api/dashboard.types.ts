/** Wire types for GET /dashboard/summary (camelCase, as sent). Amounts are decimal strings. */
export interface CurrencyAmount { currency: string; amount: string }

export interface CashIn {
  thisMonth: CurrencyAmount[];
  lastMonth: CurrencyAmount[];
  thisMonthStart: string;
  lastMonthStart: string;
  timezone: string;
}

export interface OutstandingByCurrency {
  currency: string;
  balance: string;
  count: number;
  overdueBalance: string;
  overdueCount: number;
}

export interface Outstanding { byCurrency: OutstandingByCurrency[] }

export interface UnbilledTime { projectId: string; projectName: string; currency?: string | null; hours: string; amount: string }
export interface UnbilledMilestones { projectId: string; projectName: string; currency?: string | null; count: number; amount: string }
export interface UnbilledRetainerPeriod { projectId: string; projectName: string; currency?: string | null; periodStart: string; periodEnd: string; label: string; amount: string }

export interface Unbilled {
  time: UnbilledTime[];
  milestones: UnbilledMilestones[];
  retainerPeriods: UnbilledRetainerPeriod[];
}

export interface RunningTimer {
  id: string;
  projectId: string;
  projectName: string;
  description: string;
  startTime: string;
  elapsedMinutes: number;
}

export interface DashboardSummary {
  cashIn: CashIn;
  outstanding: Outstanding;
  unbilled: Unbilled;
  runningTimer: RunningTimer | null;
  activeProjects: number;
}
