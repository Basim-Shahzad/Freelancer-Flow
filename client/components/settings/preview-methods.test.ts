import { describe, expect, it } from "vitest";
import { seedBusiness, seedInvoices, seedMethods } from "@/lib/seed";
import { editingKey, pickPreviewInvoice, previewMethods, sampleInvoice } from "./preview-methods";

describe("previewMethods", () => {
  it("excludes disabled methods and keeps order", () => {
    const ids = previewMethods(seedMethods, null, null).map((m) => m.id);
    expect(ids).toEqual(["pm-payoneer", "pm-esfca", "pm-pkrbank", "pm-raast"]);
  });
  it("applies unsaved edits to the method being edited", () => {
    const out = previewMethods(seedMethods, { mode: "edit", id: "pm-payoneer" }, { kind: "payoneer", fields: { email: "new@x.com" } });
    expect(out[0]?.fields.email).toBe("new@x.com");
    expect(out[1]?.fields.holder).toBe("Ayesha Malik");
  });
  it("does not resurrect a disabled method while editing it", () => {
    const out = previewMethods(seedMethods, { mode: "edit", id: "pm-jazzcash" }, { kind: "jazzcash", fields: { wallet: "1" } });
    expect(out.some((m) => m.id === "pm-jazzcash")).toBe(false);
  });
  it("appends a new method only once it has content", () => {
    expect(previewMethods(seedMethods, { mode: "new", kind: "wise" }, { kind: "wise", fields: { iban: " " } })).toHaveLength(4);
    const out = previewMethods(seedMethods, { mode: "new", kind: "wise" }, { kind: "wise", fields: { iban: "BE68 5390 0754 7034" } });
    expect(out).toHaveLength(5);
    expect(out[4]?.kind).toBe("wise");
  });
  it("builds stable keys", () => {
    expect(editingKey(null)).toBe("");
    expect(editingKey({ mode: "new", kind: "bank" })).toBe("new:bank");
  });
});

describe("pickPreviewInvoice", () => {
  it("prefers the most recent non-draft invoice", () => {
    expect(pickPreviewInvoice(seedInvoices)?.number).toBe("INV-0042");
  });
  it("falls back to a sample", () => {
    expect(pickPreviewInvoice([])).toBeUndefined();
    expect(sampleInvoice(seedBusiness).number).toBe("INV-0046");
  });
});
