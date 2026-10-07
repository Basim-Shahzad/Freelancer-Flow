"use client";

import { useEffect, useState } from "react";

/**
 * Seconds elapsed since an ISO timestamp, ticking every second. 0 when not running.
 * The clock reads Date.now() only after mount (0 before), so server HTML and the first client render agree
 * and React never sees a text mismatch.
 */
export function useElapsed(startedAt: string | undefined, running: boolean): number {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!running || !startedAt || now === null) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

export function formatClock(sec: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
}
