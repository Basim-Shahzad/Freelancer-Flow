import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { useActivityFeed } from "./use-activity";

let m: ReturnType<typeof mockApi>;
beforeEach(() => { m = mockApi(); seedAuth(); });
afterEach(() => m.restore());

const ev = (id: string) => ({ id, entityType: "invoice", entityId: "i1", action: "update", summary: "s", changes: null, createdAt: "2026-11-01T00:00:00Z" });
const setup = (filter = { segment: "invoice", range: "all" } as const) => {
  const qc = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useActivityFeed(filter), { wrapper });
};

describe("useActivityFeed", () => {
  it("sends filters and pages with the cursor", async () => {
    m.mock.onGet("/activity").reply((c) => (c.params.cursor ? [200, { events: [ev("b")], total: 2, nextCursor: null }] : [200, { events: [ev("a")], total: 2, nextCursor: "c1" }]));
    const { result } = setup();
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(m.mock.history.get[0]!.params).toMatchObject({ entity_type: "invoice", limit: 50 });
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(m.mock.history.get[1]!.params.cursor).toBe("c1");
    expect(result.current.hasNextPage).toBe(false);
  });

  it("refreshes the token on 401 and retries", async () => {
    m.mock.onGet("/activity").replyOnce(401).onGet("/activity").reply(200, { events: [ev("a")], total: 1, nextCursor: null });
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new" });
    const { result } = setup();
    await waitFor(() => expect(result.current.data?.pages[0]!.events).toHaveLength(1));
  });

  it("surfaces network errors", async () => {
    m.mock.onGet("/activity").networkError();
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
