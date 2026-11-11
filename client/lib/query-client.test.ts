import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { makeQueryClient, shouldRetryQuery } from "./query-client";

const err = (status?: number) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("x", "E", config, null, status ? { status, statusText: "", headers: {}, config, data: {} } : undefined);
};

describe("shouldRetryQuery", () => {
  it("retries 5xx and network errors up to twice", () => {
    expect(shouldRetryQuery(0, err(500))).toBe(true);
    expect(shouldRetryQuery(1, err())).toBe(true);
    expect(shouldRetryQuery(2, err(500))).toBe(false);
  });
  it("never retries 4xx, including 429", () => {
    for (const s of [400, 401, 404, 409, 422, 429]) expect(shouldRetryQuery(0, err(s))).toBe(false);
  });
});

describe("makeQueryClient", () => {
  it("sets network modes", () => {
    const d = makeQueryClient().getDefaultOptions();
    expect(d.queries?.networkMode).toBe("offlineFirst");
    expect(d.mutations?.networkMode).toBe("online");
    expect(d.mutations?.retry).toBe(false);
  });
});
