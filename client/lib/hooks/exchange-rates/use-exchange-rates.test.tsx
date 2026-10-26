import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestQueryClient, mockApi, seedAuth } from "@/lib/test";
import { exchangeRatesFixture } from "@/lib/test/exchange-rates";
import { useExchangeRates, usePortalExchangeRates } from "./use-exchange-rates";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated");
});
afterEach(() => m.restore());

function setup() {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("useExchangeRates", () => {
  it("loads and maps the rates", async () => {
    m.mock.onGet("/reference/exchange-rates").reply(200, exchangeRatesFixture({ base: "usd" }));
    const { result } = renderHook(() => useExchangeRates(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ base: "USD", asOf: "2026-10-20", rates: { PKR: "278.6000" } });
  });

  it("is not fetched while unauthenticated", async () => {
    seedAuth("unauthenticated");
    m.mock.onGet("/reference/exchange-rates").reply(200, exchangeRatesFixture());
    const { result } = renderHook(() => useExchangeRates(), { wrapper: setup().wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(m.mock.history.get).toHaveLength(0);
  });

  it("stays fresh: a second mount makes no second request", async () => {
    m.mock.onGet("/reference/exchange-rates").reply(200, exchangeRatesFixture());
    const { wrapper } = setup();
    const first = renderHook(() => useExchangeRates(), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    const second = renderHook(() => useExchangeRates(), { wrapper });
    expect(second.result.current.isSuccess).toBe(true);
    expect(m.mock.history.get).toHaveLength(1);
  });

  it("errors on a network failure and exposes no data", async () => {
    m.mock.onGet("/reference/exchange-rates").networkError();
    const { result } = renderHook(() => useExchangeRates(), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("usePortalExchangeRates", () => {
  it("maps the embedded block without any request", () => {
    const { result } = renderHook(() => usePortalExchangeRates(exchangeRatesFixture()), { wrapper: setup().wrapper });
    expect(result.current?.rates.PKR).toBe("278.6000");
    expect(m.mock.history.get).toHaveLength(0);
  });

  it("is null when the invoice has no rates", () => {
    const { result } = renderHook(() => usePortalExchangeRates(null), { wrapper: setup().wrapper });
    expect(result.current).toBeNull();
    expect(m.mock.history.get).toHaveLength(0);
  });
});
