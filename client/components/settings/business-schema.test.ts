import { describe, expect, it } from "vitest";
import { testBusiness } from "@/lib/test/business";
import { businessFormSchema, fromFormValues, formatSampleNumber, termsOptions, toFormValues } from "./business-schema";

const valid = () => toFormValues(testBusiness);

describe("businessFormSchema", () => {
  it("accepts a valid profile", () => {
    expect(businessFormSchema().safeParse(valid()).success).toBe(true);
  });
  it("reports missing required fields", () => {
    const r = businessFormSchema().safeParse({ ...valid(), businessName: " ", email: "nope", invoiceNumberFormat: "INV-" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["businessName", "email", "invoiceNumberFormat"]));
    }
  });
  it("allows blank optional NTN and payment instructions", () => {
    expect(businessFormSchema().safeParse({ ...valid(), taxId: "", paymentInstructions: "" }).success).toBe(true);
  });
  it("requires a {seq} placeholder in the number format", () => {
    expect(businessFormSchema().safeParse({ ...valid(), invoiceNumberFormat: "INV-{seq}" }).success).toBe(true);
    expect(businessFormSchema().safeParse({ ...valid(), invoiceNumberFormat: "{year}-{seq:04d}" }).success).toBe(true);
    expect(businessFormSchema().safeParse({ ...valid(), invoiceNumberFormat: "INV-0001" }).success).toBe(false);
    expect(businessFormSchema().safeParse({ ...valid(), invoiceNumberFormat: "" }).success).toBe(false);
  });
  it("caps payment instructions at 2000 characters", () => {
    expect(businessFormSchema().safeParse({ ...valid(), paymentInstructions: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("form mapping", () => {
  it("round-trips the profile", () => {
    expect(fromFormValues(toFormValues(testBusiness), testBusiness)).toEqual({ ...testBusiness, logoUrl: undefined });
  });
  it("renders a sample number from the format", () => {
    expect(formatSampleNumber("INV-{seq:04d}")).toBe("INV-0001");
    expect(formatSampleNumber("{year}/{seq}", 7, 2027)).toBe("2027/7");
    expect(formatSampleNumber("")).toBe("");
  });
  it("keeps a non-preset terms value selectable", () => {
    expect(termsOptions(21).map((t) => t.days)).toContain(21);
    expect(termsOptions(14).length).toBe(6);
  });
});

describe("hourly rate", () => {
  it("is optional, parsed to minor units and round-trips", () => {
    expect(toFormValues(testBusiness).hourlyRate).toBe("40.00");
    expect(businessFormSchema().safeParse({ ...valid(), hourlyRate: "" }).success).toBe(true);
    expect(fromFormValues({ ...valid(), hourlyRate: "" }).hourlyRate).toBeUndefined();
    expect(fromFormValues({ ...valid(), hourlyRate: "42.5" }).hourlyRate).toBe(4250);
  });
  it("rejects zero, negative and non-numeric rates", () => {
    for (const bad of ["0", "-5", "abc"]) expect(businessFormSchema().safeParse({ ...valid(), hourlyRate: bad }).success).toBe(false);
  });
});
