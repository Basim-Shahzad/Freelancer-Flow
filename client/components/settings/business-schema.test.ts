import { describe, expect, it } from "vitest";
import { seedBusiness } from "@/lib/seed";
import { businessFormSchema, fromFormValues, minNextInvoiceNumber, nextNumberPreview, termsOptions, toFormValues } from "./business-schema";

const valid = () => toFormValues(seedBusiness);

describe("minNextInvoiceNumber", () => {
  it("is one above the highest issued number for the prefix", () => {
    expect(minNextInvoiceNumber(["INV-0042", "INV-0045", "INV-0036"], "INV-")).toBe(46);
  });
  it("ignores other prefixes and non-numeric suffixes", () => {
    expect(minNextInvoiceNumber(["INV-0042", "OLD-0099", "INV-ABC"], "INV-")).toBe(43);
    expect(minNextInvoiceNumber(["INV-0042"], "2026-")).toBe(1);
  });
});

describe("businessFormSchema", () => {
  it("accepts the seed profile", () => {
    expect(businessFormSchema(["INV-0045"]).safeParse(valid()).success).toBe(true);
  });
  it("reports missing required fields", () => {
    const r = businessFormSchema().safeParse({ ...valid(), businessName: " ", email: "nope", phone: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["businessName", "email", "phone"]));
    }
  });
  it("allows blank optional NTN and footer", () => {
    expect(businessFormSchema().safeParse({ ...valid(), taxId: "", footerNote: "" }).success).toBe(true);
  });
  it("never lets the next number go back onto an issued number", () => {
    const r = businessFormSchema(["INV-0045"]).safeParse({ ...valid(), nextInvoiceNumber: "0040" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/never reused/);
  });
  it("allows restarting numbering under a new prefix", () => {
    expect(businessFormSchema(["INV-0045"]).safeParse({ ...valid(), invoicePrefix: "2027-", nextInvoiceNumber: "1" }).success).toBe(true);
  });
});

describe("form mapping", () => {
  it("round-trips the profile", () => {
    expect(fromFormValues(toFormValues(seedBusiness))).toEqual({ ...seedBusiness, logoName: undefined });
  });
  it("pads the next number and previews it", () => {
    expect(toFormValues(seedBusiness).nextInvoiceNumber).toBe("0046");
    expect(nextNumberPreview("INV-", "46")).toBe("INV-0046");
    expect(nextNumberPreview("INV-", "x")).toBe("");
  });
  it("keeps a non-preset terms value selectable", () => {
    expect(termsOptions(21).map((t) => t.days)).toContain(21);
    expect(termsOptions(14).length).toBe(6);
  });
});

describe("hourly rate", () => {
  it("is optional, parsed to minor units and round-trips", () => {
    expect(toFormValues(seedBusiness).hourlyRate).toBe("40.00");
    expect(businessFormSchema().safeParse({ ...valid(), hourlyRate: "" }).success).toBe(true);
    expect(fromFormValues({ ...valid(), hourlyRate: "" }).hourlyRate).toBeUndefined();
    expect(fromFormValues({ ...valid(), hourlyRate: "42.5" }).hourlyRate).toBe(4250);
  });
  it("rejects zero, negative and non-numeric rates", () => {
    for (const bad of ["0", "-5", "abc"]) expect(businessFormSchema().safeParse({ ...valid(), hourlyRate: bad }).success).toBe(false);
  });
});
