"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Copy text to the clipboard and expose which key was just copied (resets after 1.8s). */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = useCallback(async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: still show state */ }
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  }, []);
  return { copied, copy };
}
