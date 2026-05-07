import type { ProjectInList } from "../projects/types.js";

export const months: string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const daysOfWeek: string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Returns the last N days as "D Mon" strings, oldest → newest */
export function getLastDays(count: number): string[] {
   const dates: string[] = [];
   const now = new Date();
   for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      dates.push(`${d.getUTCDate()} ${months[d.getUTCMonth()]}`);
   }
   return dates;
}

/** Returns the last 7 days as "D Mon" strings, oldest → newest */
export function getLastSevenDates(): string[] {
   return getLastDays(7);
}

/** Returns the last 12 months */
export function getLast12Months(): string[] {
   const currentMonth = new Date().getMonth();
   return [...months.slice(currentMonth + 1), ...months.slice(0, currentMonth + 1)];
}

/**
 * Generates realistic-looking revenue data points around a baseline.
 * Uses a seeded pseudo-random walk so values look organic, not flat.
 *
 * BASICALLY FAKE PAST DATA USING SOME NERDY STUFF
 *
 */
export function generateRevenuePoints(baseRevenue: number, count: number, seed = 42): number[] {
   const points: number[] = [];
   // Simple LCG seeded PRNG for reproducible "realistic" data
   let s = seed;
   const rand = () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
   };

   let current = baseRevenue * 0.7;
   for (let i = 0; i < count; i++) {
      // Random walk with mean-reversion toward baseRevenue
      const noise = (rand() - 0.45) * baseRevenue * 0.15;
      const pull = (baseRevenue - current) * 0.08;
      current = Math.max(0, current + noise + pull);
      points.push(Math.round(current * 100) / 100);
   }
   // Make last point land near the actual baseRevenue for coherence
   points[points.length - 1] = baseRevenue;

   return points;
}
