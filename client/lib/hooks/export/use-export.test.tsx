import { renderHook, waitFor } from "@testing-library/react";
import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/store/auth";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { exportErrorMessage, useExportData } from "./use-export";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi(); seedAuth();
  URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => m.restore());

const run = async (password = "pw") => {
  const qc = createTestQueryClient();
  const { result } = renderHook(() => useExportData(), { wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
  result.current.mutate(password);
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result.current;
};

describe("useExportData", () => {
  it("posts the password as a blob request and downloads", async () => {
    m.mock.onPost("/export").reply(200, new Blob(["zip"]));
    const r = await run();
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ password: "pw" });
    expect(m.mock.history.post[0]!.responseType).toBe("blob");
    expect(r.data).toMatch(/^paylancr-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it.each([[401, /password/], [403, /password/], [429, /too many/i]])("maps %i", async (status, re) => {
    m.mock.onPost("/export").reply(status, { detail: "x" });
    const r = await run();
    expect(r.isError).toBe(true);
    expect(exportErrorMessage(r.error)).toMatch(re);
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(m.refresh.history.post).toHaveLength(0);
  });

  it("maps a network error", async () => {
    m.mock.onPost("/export").networkError();
    const r = await run();
    expect(exportErrorMessage(r.error)).toMatch(/reach the server/i);
  });
});
