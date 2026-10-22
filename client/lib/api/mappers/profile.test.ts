import { describe, expect, it } from "vitest";
import { profileFixture, testUser } from "@/lib/test";
import type { BusinessLocal } from "@/lib/types";
import { isProfileComplete, profileToBusiness, splitBusinessPatch } from "./profile";

const local: BusinessLocal = { phone: "+92 300 0000000", footerNote: "Thanks", invoicePrefix: "INV-", nextInvoiceNumber: 7, logoName: "logo.png" };

describe("isProfileComplete", () => {
  it("needs a non-blank business name", () => {
    expect(isProfileComplete(profileFixture())).toBe(true);
    expect(isProfileComplete(profileFixture({ businessName: null }))).toBe(false);
    expect(isProfileComplete(profileFixture({ businessName: "  " }))).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });
});

describe("profileToBusiness", () => {
  it("maps API fields, account fields and local fields", () => {
    const b = profileToBusiness(profileFixture({ hourlyRate: "40.50" }), testUser, local);
    expect(b).toMatchObject({
      businessName: "Malik Studio", taxId: "1234567-8", address: "Gulberg III, Lahore", defaultCurrency: "USD", defaultTermsDays: 14,
      hourlyRate: 4050, ownerName: "Test User", email: "test@example.com", phone: local.phone, invoicePrefix: "INV-", nextInvoiceNumber: 7, logoName: "logo.png",
    });
  });

  it("handles a brand-new profile and unknown values", () => {
    const b = profileToBusiness(profileFixture({ businessName: null, businessAddress: null, taxRegistrationNumber: null, hourlyRate: null, currency: "JPY" }), null, local);
    expect(b).toMatchObject({ businessName: "", address: "", taxId: "", defaultCurrency: "USD", ownerName: "", email: "" });
    expect(b.hourlyRate).toBeUndefined();
  });

  it("treats a zero or malformed hourly rate as unset", () => {
    expect(profileToBusiness(profileFixture({ hourlyRate: "0.00" }), null, local).hourlyRate).toBeUndefined();
    expect(profileToBusiness(profileFixture({ hourlyRate: "abc" }), null, local).hourlyRate).toBeUndefined();
  });

  it("uses currency exponents (PKR has none, so 4000.00 -> 4000)", () => {
    expect(profileToBusiness(profileFixture({ currency: "PKR", hourlyRate: "4000.00" }), null, local).hourlyRate).toBe(4000);
  });

  it("works while the profile is still loading", () => {
    expect(profileToBusiness(undefined, testUser, local).businessName).toBe("");
  });
});

describe("splitBusinessPatch", () => {
  it("renames API fields, nulls blanks and routes local-only fields", () => {
    const { remote, local: loc } = splitBusinessPatch(
      { businessName: " Acme ", taxId: "", address: "Lahore", defaultCurrency: "PKR", defaultTermsDays: 30, hourlyRate: 400050, phone: "1", footerNote: "x", invoicePrefix: "A-", nextInvoiceNumber: 9, logoName: undefined },
      "USD",
    );
    expect(remote).toEqual({ businessName: "Acme", taxRegistrationNumber: null, businessAddress: "Lahore", currency: "PKR", defaultPaymentTermsDays: 30, hourlyRate: "400050" });
    expect(loc).toEqual({ phone: "1", footerNote: "x", invoicePrefix: "A-", nextInvoiceNumber: 9, logoName: undefined });
  });

  it("encodes the rate in the profile currency when the patch does not change it, and clears it when unset", () => {
    expect(splitBusinessPatch({ hourlyRate: 4000 }, "USD").remote).toEqual({ hourlyRate: "40.00" });
    expect(splitBusinessPatch({ hourlyRate: undefined }, "USD").remote).toEqual({ hourlyRate: null });
  });

  it("sends nothing for ownerName / email (they belong to the account)", () => {
    expect(splitBusinessPatch({ ownerName: "A", email: "a@b.c" }, "USD")).toEqual({ remote: {}, local: {} });
  });
});
