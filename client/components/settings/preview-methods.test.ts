import { describe, expect, it } from "vitest";
import { testBusiness } from "@/lib/test/business";
import { methodFixtures } from "@/lib/test/payment-methods";
import { editingKey, previewMethods, sampleInvoice } from "./preview-methods";

const methods = methodFixtures();

describe("previewMethods", () => {
  it("excludes disabled methods and keeps order", () => {
    const ids = previewMethods(methods, null, null).map((m) => m.id);
    expect(ids).toEqual(["pm-payoneer", "pm-esfca", "pm-pkrbank", "pm-raast"]);
  });
  it("applies unsaved edits to the method being edited", () => {
    const out = previewMethods(methods, { mode: "edit", id: "pm-payoneer" }, { kind: "payoneer", label: "Payoneer", fields: { accountEmail: "new@x.com" } });
    expect(out[0]?.fields.accountEmail).toBe("new@x.com");
    expect(out[1]?.fields.beneficiaryName).toBe("Ayesha Malik");
  });
  it("does not resurrect a disabled method while editing it", () => {
    const out = previewMethods(methods, { mode: "edit", id: "pm-jazzcash" }, { kind: "jazzcash", label: "JazzCash", fields: { mobileNumber: "1" } });
    expect(out.some((m) => m.id === "pm-jazzcash")).toBe(false);
  });
  it("appends a new method only once it has content", () => {
    expect(previewMethods(methods, { mode: "new", kind: "wise" }, { kind: "wise", label: "Wise", fields: { iban: " " } })).toHaveLength(4);
    const out = previewMethods(methods, { mode: "new", kind: "wise" }, { kind: "wise", label: "Wise", fields: { iban: "BE68 5390 0754 7034" } });
    expect(out).toHaveLength(5);
    expect(out[4]?.kind).toBe("wise");
  });
  it("builds stable keys", () => {
    expect(editingKey(null)).toBe("");
    expect(editingKey({ mode: "new", kind: "bank" })).toBe("new:bank");
  });
});

describe("sampleInvoice", () => {
  it("numbers the sample from the business's number format", () => {
    expect(sampleInvoice(testBusiness).number).toBe("INV-0001");
    expect(sampleInvoice({ ...testBusiness, invoiceNumberFormat: "" }).number).toBe("INV-0001");
  });
});
