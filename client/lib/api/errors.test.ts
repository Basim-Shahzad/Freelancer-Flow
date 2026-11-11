import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { classifyApiError } from "./errors";

const err = (status?: number, headers: Record<string, string> = {}) => {
  const config = { headers: new AxiosHeaders() };
  const response = status ? { status, statusText: "", headers, config, data: {} } : undefined;
  return new AxiosError("x", "E", config, null, response);
};

describe("classifyApiError", () => {
  it.each([
    [undefined, "offline"], [404, "notFound"], [401, "unauthorized"], [409, "conflict"],
    [422, "validation"], [500, "server"], [503, "server"], [400, "unknown"],
  ] as const)("status %s -> %s", (status, kind) => expect(classifyApiError(err(status)).kind).toBe(kind));

  it("parses Retry-After on 429", () => {
    expect(classifyApiError(err(429, { "retry-after": "12" }))).toMatchObject({ kind: "rateLimited", retryAfter: 12 });
  });
  it("leaves retryAfter undefined when absent or non-numeric", () => {
    expect(classifyApiError(err(429)).retryAfter).toBeUndefined();
    expect(classifyApiError(err(429, { "retry-after": "Wed, 21 Oct" })).retryAfter).toBeUndefined();
  });
  it("non-axios errors are unknown", () => expect(classifyApiError(new Error("x")).kind).toBe("unknown"));
});
