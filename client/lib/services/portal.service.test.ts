import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/lib/store/auth";
import { portalApi, portalService } from "./portal.service";

describe("portalService", () => {
  let mock: MockAdapter;
  beforeEach(() => { mock = new MockAdapter(portalApi, { onNoMatch: "throwException" }); useAuthStore.setState({ accessToken: "owner", status: "authenticated" }); });
  afterEach(() => mock.restore());

  it("sends the token as a Bearer header, never as a query param, and never the owner token", async () => {
    mock.onGet("/portal/project/p1").reply(200, { id: "p1" });
    await portalService.project("p1", "tok");
    const req = mock.history.get[0]!;
    expect(req.headers?.Authorization).toBe("Bearer tok");
    expect(req.params).toBeUndefined();
    expect(req.url).not.toContain("token");
    expect(req.withCredentials).toBeFalsy();
  });

  it("a 401 neither refreshes nor touches the auth store", async () => {
    mock.onGet("/portal/invoice/i1").reply(401, { detail: "expired" });
    await expect(portalService.invoice("i1", "tok")).rejects.toMatchObject({ response: { status: 401 } });
    expect(mock.history.get).toHaveLength(1);
    expect(useAuthStore.getState().accessToken).toBe("owner");
  });

  it("posts decisions with an optional comment", async () => {
    mock.onPost("/portal/milestone/m1/approve").reply(200, { id: "m1" });
    mock.onPost("/portal/milestone/m1/reject").reply(200, { id: "m1" });
    await portalService.approve("m1", "tok");
    await portalService.reject("m1", "tok", " needs work ");
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({});
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({ comment: "needs work" });
  });

  it("fetches the pdf as a blob and converts with only a password", async () => {
    mock.onGet("/portal/invoice/i1/pdf").reply(200, new Blob(["x"]));
    mock.onPost("/portal/convert").reply(200, {});
    expect(await portalService.invoicePdf("i1", "tok")).toBeInstanceOf(Blob);
    await portalService.convert("tok", "password1");
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({ password: "password1" });
  });
});
