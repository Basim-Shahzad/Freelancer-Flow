import type { AxiosHeaders, AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockApi, seedAuth } from "@/lib/test";
import { useAuthStore } from "@/lib/store/auth";
import { api, getApiErrorMessage, getApiErrorStatus } from "./api.service";

let m: ReturnType<typeof mockApi>;

const authOf = (config: AxiosRequestConfig) => (config.headers as AxiosHeaders | undefined)?.get("Authorization");

beforeEach(() => {
  m = mockApi();
  seedAuth("authenticated", "old-token");
});
afterEach(() => m.restore());

describe("request interceptor", () => {
  it("attaches the Bearer token", async () => {
    m.mock.onGet("/clients").reply((config) => [200, { auth: authOf(config) }]);
    const res = await api.get("/clients");
    expect(res.data.auth).toBe("Bearer old-token");
  });

  it("sends no Authorization header without a token", async () => {
    seedAuth("unauthenticated");
    m.mock.onGet("/clients").reply((config) => [200, { auth: authOf(config) ?? null }]);
    expect((await api.get("/clients")).data.auth).toBeNull();
  });
});

describe("401 refresh flow", () => {
  it("refreshes once, stores the new token and retries the request", async () => {
    m.mock.onGet("/clients").reply((config) =>
      authOf(config) === "Bearer new-token" ? [200, { ok: true }] : [401, { detail: "expired" }],
    );
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new-token" });

    const res = await api.get("/clients");

    expect(res.data).toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe("new-token");
    expect(m.refresh.history.post).toHaveLength(1);
    expect(m.mock.history.get).toHaveLength(2);
  });

  it("shares a single refresh between concurrent 401s", async () => {
    m.mock.onGet(/\/(clients|projects)/).reply((config) =>
      authOf(config) === "Bearer new-token" ? [200, { ok: true }] : [401],
    );
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new-token" });

    const results = await Promise.all([api.get("/clients"), api.get("/projects"), api.get("/clients")]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(m.refresh.history.post).toHaveLength(1);
  });

  it("clears auth and rejects when the refresh fails", async () => {
    m.mock.onGet("/clients").reply(401);
    m.refresh.onPost("/auth/refresh").reply(401, { detail: "Invalid refresh token" });

    await expect(api.get("/clients")).rejects.toMatchObject({ response: { status: 401 } });

    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.status).toBe("unauthenticated");
  });

  it("does not loop when the retried request is still 401", async () => {
    m.mock.onGet("/clients").reply(401);
    m.refresh.onPost("/auth/refresh").reply(200, { accessToken: "new-token" });

    await expect(api.get("/clients")).rejects.toMatchObject({ response: { status: 401 } });

    expect(m.refresh.history.post).toHaveLength(1);
    expect(m.mock.history.get).toHaveLength(2);
  });

  it.each(["/auth/login", "/auth/register"])("does not refresh on a 401 from %s", async (url) => {
    m.mock.onPost(url).reply(401, { detail: "Incorrect email or password" });

    await expect(api.post(url, {})).rejects.toMatchObject({ response: { status: 401 } });

    expect(m.refresh.history.post).toHaveLength(0);
    expect(m.mock.history.post).toHaveLength(1);
  });

  it("does not refresh on non-401 errors", async () => {
    m.mock.onGet("/clients").reply(500);
    await expect(api.get("/clients")).rejects.toMatchObject({ response: { status: 500 } });
    expect(m.refresh.history.post).toHaveLength(0);
  });
});

describe("error helpers", () => {
  const fail = async (status: number, body?: unknown) => {
    m.mock.onGet("/x").reply(status, body);
    return api.get("/x").catch((e: unknown) => e);
  };

  it("reads a string detail", async () => {
    const e = await fail(409, { detail: "Client has projects" });
    expect(getApiErrorMessage(e)).toBe("Client has projects");
    expect(getApiErrorStatus(e)).toBe(409);
  });

  it("joins a validation list", async () => {
    const e = await fail(422, { detail: [{ loc: ["body", "email"], msg: "Bad email", type: "x" }, { loc: ["body", "name"], msg: "Required", type: "x" }] });
    expect(getApiErrorMessage(e)).toBe("Bad email Required");
  });

  it("reports 404 status", async () => {
    expect(getApiErrorStatus(await fail(404, { detail: "Not found" }))).toBe(404);
  });

  it("reports network errors", async () => {
    m.mock.onGet("/x").networkError();
    const e = await api.get("/x").catch((err: unknown) => err);
    expect(getApiErrorMessage(e)).toMatch(/can’t reach the server/i);
    expect(getApiErrorStatus(e)).toBeUndefined();
  });

  it("falls back for unknown errors", () => {
    expect(getApiErrorMessage(new Error("x"), "fallback")).toBe("fallback");
  });
});
