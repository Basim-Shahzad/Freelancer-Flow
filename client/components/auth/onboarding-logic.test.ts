import { describe, expect, it, vi } from "vitest";
import { MethodCreateError, buildCompletion, newProgress, runCompletion, buildSummary, estimateCurrency, initialData, methodsToCreate, previewAmount, validateMethods, type MethodsValues } from "./onboarding-logic";

const payoneer = { kind: "payoneer" as const, label: "Payoneer", fields: { accountEmail: "a@b.co" } };
const raast = { kind: "raast" as const, label: "Raast", fields: { raastId: "0300 5550214", accountTitle: "Ayesha" } };

describe("validateMethods", () => {
  it("fails with nothing selected", () => {
    const r = validateMethods({ selected: [], drafts: {}, saved: [] });
    expect(r.ok).toBe(false);
  });
  it("asks for details of unsaved methods", () => {
    const m: MethodsValues = { selected: ["payoneer", "raast"], drafts: { payoneer }, saved: ["payoneer"] };
    const r = validateMethods(m);
    expect(r).toMatchObject({ ok: false, firstMissing: "raast" });
    expect(!r.ok && r.message).toContain("Raast");
  });
  it("passes when all selected are saved", () => {
    expect(validateMethods({ selected: ["payoneer"], drafts: { payoneer }, saved: ["payoneer"] }).ok).toBe(true);
  });
});

describe("methodsToCreate", () => {
  it("keeps only ticked and saved methods, in order", () => {
    const m: MethodsValues = { selected: ["raast", "payoneer"], drafts: { payoneer, raast }, saved: ["payoneer", "raast"] };
    expect(methodsToCreate(m).map((x) => x.kind)).toEqual(["raast", "payoneer"]);
    expect(methodsToCreate({ ...m, saved: ["payoneer"] }).map((x) => x.kind)).toEqual(["payoneer"]);
    expect(methodsToCreate({ ...m, selected: ["payoneer"] }).map((x) => x.kind)).toEqual(["payoneer"]);
  });
});

describe("estimateCurrency", () => {
  it("shows the other currency for 'both'", () => {
    expect(estimateCurrency("USD", "both")).toBe("PKR");
    expect(estimateCurrency("PKR", "both")).toBe("USD");
  });
  it("hides the estimate when it equals the invoice currency", () => {
    expect(estimateCurrency("USD", "usd")).toBeUndefined();
    expect(estimateCurrency("PKR", "pkr")).toBeUndefined();
    expect(estimateCurrency("PKR", "usd")).toBe("USD");
  });
  it("previews 1,000 USD or the PKR equivalent", () => {
    expect(previewAmount("USD")).toBe(100000);
    expect(previewAmount("PKR")).toBe(27860000);
  });
});

describe("buildSummary / buildCompletion", () => {
  const base = initialData({ name: "Ayesha Malik", country: "PK" });
  const data = {
    ...base,
    business: { ...base.business, businessName: "Malik Studio", city: "Lahore", address: "Gulberg III", taxId: "1234567-8" },
    methods: { selected: ["payoneer" as const], drafts: { payoneer }, saved: ["payoneer" as const] },
  };

  it("summarises a skipped client", () => {
    const s = buildSummary(data);
    expect(s[0]?.v).toBe("Malik Studio · Lahore");
    expect(s[1]?.v).toBe("Bills in USD · shows PKR and USD together");
    expect(s[2]?.v).toBe("Payoneer");
    expect(s[3]?.v).toBe("Skipped for now");
  });
  it("says so when no methods were saved", () => {
    expect(buildSummary({ ...data, methods: { selected: [], drafts: {}, saved: [] } })[2]?.v).toMatch(/Settings/);
  });
  it("builds the store payload without a client when skipped", () => {
    const c = buildCompletion(data, "a@b.co");
    expect(c.client).toBeUndefined();
    expect(c.business).toMatchObject({ businessName: "Malik Studio", email: "a@b.co", taxId: "1234567-8", defaultCurrency: "USD", address: "Gulberg III, Lahore, Pakistan" });
    expect(c.methods).toHaveLength(1);
  });
  it("builds a client with a normalised whatsapp number", () => {
    const c = buildCompletion({ ...data, client: { name: "Hamza", company: "Gulberg Textiles", email: "h@g.example", whatsapp: "92 321 4567890", currency: "PKR" } }, "a@b.co");
    expect(c.client).toMatchObject({ name: "Hamza", companyName: "Gulberg Textiles", whatsapp: "+92 321 4567890", currency: "PKR", termsDays: 14 });
  });
});

describe("runCompletion", () => {
  const completion = (): ReturnType<typeof buildCompletion> => {
    const d = initialData({ name: "Ayesha" });
    d.business.businessName = "Malik Studio";
    d.methods = { selected: ["payoneer", "raast"], drafts: { payoneer, raast }, saved: ["payoneer", "raast"] };
    d.client = { name: "Jordan", company: "Harbor", email: "j@h.co", whatsapp: "", currency: "USD" };
    return buildCompletion(d, "a@b.co");
  };
  const steps = () => ({ saveProfile: vi.fn().mockResolvedValue(undefined), addClient: vi.fn().mockResolvedValue(undefined), addMethod: vi.fn().mockResolvedValue(undefined) });

  it("saves the profile first, then the client, then each method", async () => {
    const s = steps();
    const order: string[] = [];
    s.saveProfile.mockImplementation(async () => { order.push("profile"); });
    s.addClient.mockImplementation(async () => { order.push("client"); });
    s.addMethod.mockImplementation(async (m: { kind: string }) => { order.push(m.kind); });
    const progress = newProgress();
    await runCompletion(completion(), "PK", s, progress);
    expect(order).toEqual(["profile", "client", "payoneer", "raast"]);
    expect(progress).toEqual({ profile: true, client: true, methods: 2 });
  });

  it("stops when the profile fails, leaving nothing else created", async () => {
    const s = steps();
    s.saveProfile.mockRejectedValue(new Error("offline"));
    const progress = newProgress();
    await expect(runCompletion(completion(), "PK", s, progress)).rejects.toThrow("offline");
    expect(s.addClient).not.toHaveBeenCalled();
    expect(s.addMethod).not.toHaveBeenCalled();
    expect(progress.profile).toBe(false);
  });

  it("resumes after a partial failure without repeating finished steps", async () => {
    const s = steps();
    s.addMethod.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("storage full"));
    const progress = newProgress();
    await expect(runCompletion(completion(), "PK", s, progress)).rejects.toThrow("storage full");
    expect(progress).toEqual({ profile: true, client: true, methods: 1 });
    await runCompletion(completion(), "PK", s, progress);
    expect(s.saveProfile).toHaveBeenCalledTimes(1);
    expect(s.addClient).toHaveBeenCalledTimes(1);
    expect(s.addMethod).toHaveBeenCalledTimes(3); // payoneer ok, raast failed, raast retried
    expect(progress.methods).toBe(2);
  });

  it("resumes after the client step fails without saving the profile again or marking the client done", async () => {
    const s = steps();
    s.addClient.mockRejectedValueOnce(new Error("409")).mockResolvedValueOnce(undefined);
    const progress = newProgress();
    await expect(runCompletion(completion(), "PK", s, progress)).rejects.toThrow("409");
    expect(progress).toEqual({ profile: true, client: false, methods: 0 });
    expect(s.addMethod).not.toHaveBeenCalled();
    await runCompletion(completion(), "PK", s, progress);
    expect(s.saveProfile).toHaveBeenCalledTimes(1);
    expect(s.addClient).toHaveBeenCalledTimes(2);
    expect(progress).toEqual({ profile: true, client: true, methods: 2 });
  });

  it("wraps a failed method in MethodCreateError carrying its draft, and resumes at that method", async () => {
    const s = steps();
    const cause = new Error("422");
    s.addMethod.mockResolvedValueOnce(undefined).mockRejectedValueOnce(cause);
    const progress = newProgress();
    const err = await runCompletion(completion(), "PK", s, progress).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MethodCreateError);
    expect((err as MethodCreateError).draft.kind).toBe("raast");
    expect((err as MethodCreateError).cause).toBe(cause);
    expect(progress.methods).toBe(1);
  });

  it("skips the client when the step was left blank", async () => {
    const s = steps();
    const c = completion();
    delete c.client;
    await runCompletion(c, "PK", s, newProgress());
    expect(s.addClient).not.toHaveBeenCalled();
  });
});
