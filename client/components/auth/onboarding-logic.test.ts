import { describe, expect, it } from "vitest";
import { buildCompletion, buildSummary, estimateCurrency, initialData, methodsToCreate, previewAmount, validateMethods, type MethodsValues } from "./onboarding-logic";

const payoneer = { kind: "payoneer" as const, fields: { email: "a@b.co" } };
const raast = { kind: "raast" as const, fields: { raastId: "0300 5550214", holder: "Ayesha" } };

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
    const c = buildCompletion({ ...data, client: { contactName: "Hamza", company: "Gulberg Textiles", email: "h@g.example", whatsapp: "92 321 4567890", city: "Lahore", currency: "PKR" } }, "a@b.co");
    expect(c.client).toMatchObject({ name: "Gulberg Textiles", contactName: "Hamza", whatsapp: "+92 321 4567890", country: "PK", currency: "PKR", prefersMethods: ["payoneer"] });
  });
});
