import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { prefetchOnIntent } from "./use-prefetch";

const key = ["x", "1"] as const;

describe("prefetchOnIntent", () => {
  it("fires once for repeated intent while data is fresh", async () => {
    const qc = new QueryClient();
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const h = prefetchOnIntent(qc, true, key, fn, 60_000);
    h.onPointerEnter(); h.onFocus(); h.onPointerEnter();
    await vi.waitFor(() => expect(qc.getQueryData(key)).toEqual({ ok: true }));
    h.onPointerEnter();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("skips while offline", () => {
    const qc = new QueryClient();
    const fn = vi.fn().mockResolvedValue(1);
    prefetchOnIntent(qc, false, key, fn, 60_000).onPointerEnter();
    expect(fn).not.toHaveBeenCalled();
  });
  it("skips when cached data is fresh", async () => {
    const qc = new QueryClient();
    qc.setQueryData(key, 1);
    const fn = vi.fn().mockResolvedValue(2);
    prefetchOnIntent(qc, true, key, fn, 60_000).onPointerEnter();
    await Promise.resolve();
    expect(fn).not.toHaveBeenCalled();
  });
});
