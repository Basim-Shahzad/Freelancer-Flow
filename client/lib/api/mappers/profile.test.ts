import { describe, expect, it } from "vitest";
import { profileFixture, testUser } from "@/lib/test";
import { isProfileComplete, profileToBusiness, businessToProfileUpdate } from "./profile";

describe("isProfileComplete", () => {
  it("needs a non-blank business name", () => {
    expect(isProfileComplete(profileFixture())).toBe(true);
    expect(isProfileComplete(profileFixture({ businessName: null }))).toBe(false);
    expect(isProfileComplete(profileFixture({ businessName: "  " }))).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });
});

describe("profileToBusiness", () => {
  it("maps API fields and account fields", () => {
    const b = profileToBusiness(profileFixture({ hourlyRate: "40.50" }), testUser);
    expect(b).toMatchObject({
      businessName: "Malik Studio", taxId: "1234567-8", address: "Gulberg III, Lahore", defaultCurrency: "USD", defaultTermsDays: 14,
      hourlyRate: 4050, ownerName: "Test User", email: "test@example.com", invoiceNumberFormat: "INV-{seq}", paymentInstructions: "",
    });
  });

  it("handles a brand-new profile and unknown values", () => {
    const b = profileToBusiness(profileFixture({ businessName: null, businessAddress: null, taxRegistrationNumber: null, hourlyRate: null, currency: "JPY" }), null);
    expect(b).toMatchObject({ businessName: "", address: "", taxId: "", defaultCurrency: "USD", ownerName: "", email: "" });
    expect(b.hourlyRate).toBeUndefined();
  });

  it("treats a zero or malformed hourly rate as unset", () => {
    expect(profileToBusiness(profileFixture({ hourlyRate: "0.00" }), null).hourlyRate).toBeUndefined();
    expect(profileToBusiness(profileFixture({ hourlyRate: "abc" }), null).hourlyRate).toBeUndefined();
  });

  it("uses currency exponents (PKR has none, so 4000.00 -> 4000)", () => {
    expect(profileToBusiness(profileFixture({ currency: "PKR", hourlyRate: "4000.00" }), null).hourlyRate).toBe(4000);
  });

  it("works while the profile is still loading", () => {
    expect(profileToBusiness(undefined, testUser).businessName).toBe("");
  });
});

describe("businessToProfileUpdate", () => {
  it("renames API fields and nulls blanks", () => {
    const body = businessToProfileUpdate(
      { businessName: " Acme ", taxId: "", address: "Lahore", defaultCurrency: "PKR", defaultTermsDays: 30, hourlyRate: 400050, paymentInstructions: " ", invoiceNumberFormat: " A-{seq} " },
      "USD",
    );
    expect(body).toEqual({ businessName: "Acme", taxRegistrationNumber: null, businessAddress: "Lahore", currency: "PKR", defaultPaymentTermsDays: 30, hourlyRate: "400050", paymentInstructions: null, invoiceNumberFormat: "A-{seq}" });
  });

  it("maps invoiceNumberFormat, logoUrl and paymentInstructions from the profile", () => {
    const b = profileToBusiness(profileFixture({ invoiceNumberFormat: "{year}-{seq:04d}", logoUrl: "https://x.test/l.png", paymentInstructions: "Pay by wire" }), null);
    expect(b).toMatchObject({ invoiceNumberFormat: "{year}-{seq:04d}", logoUrl: "https://x.test/l.png", paymentInstructions: "Pay by wire" });
    const empty = profileToBusiness(profileFixture({ logoUrl: null, paymentInstructions: null }), null);
    expect(empty.logoUrl).toBeUndefined();
    expect(empty.paymentInstructions).toBe("");
  });

  it("encodes the rate in the profile currency when the patch does not change it, and clears it when unset", () => {
    expect(businessToProfileUpdate({ hourlyRate: 4000 }, "USD")).toEqual({ hourlyRate: "40.00" });
    expect(businessToProfileUpdate({ hourlyRate: undefined }, "USD")).toEqual({ hourlyRate: null });
  });

  it("sends nothing for ownerName / email (they belong to the account)", () => {
    expect(businessToProfileUpdate({ ownerName: "A", email: "a@b.c" }, "USD")).toEqual({});
  });
});
