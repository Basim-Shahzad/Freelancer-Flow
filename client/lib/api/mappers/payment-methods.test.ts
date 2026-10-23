import { describe, expect, it } from "vitest";
import { METHOD_KINDS, fieldsFor } from "@/lib/payment-methods";
import { bankDetails, detailsByType, paymentMethodResponseFixture } from "@/lib/test/payment-methods";
import type { BankScheme, PaymentMethodKind } from "@/lib/types";
import { KIND_TO_TYPE, TYPE_TO_KIND, toCreate, toDetails, toPaymentMethod, toUpdate } from "./payment-methods";

const kinds = Object.keys(METHOD_KINDS) as PaymentMethodKind[];
const nonBank = kinds.filter((k) => k !== "bank");
const schemes = Object.keys(bankDetails) as BankScheme[];

describe("kind <-> type", () => {
  it("covers all 10 types both ways", () => {
    expect(kinds).toHaveLength(10);
    for (const k of kinds) expect(TYPE_TO_KIND[KIND_TO_TYPE[k]]).toBe(k);
    expect(new Set(Object.values(KIND_TO_TYPE)).size).toBe(10);
  });
});

describe("round trip", () => {
  it.each(nonBank)("%s: response -> view model -> details is the identity", (kind) => {
    const type = KIND_TO_TYPE[kind] as keyof typeof detailsByType;
    const m = toPaymentMethod(paymentMethodResponseFixture(type));
    expect(m.kind).toBe(kind);
    expect(m.scheme).toBeUndefined();
    expect(m.fields).toEqual(detailsByType[type]);
    expect(toDetails(m.kind, m.scheme, m.fields)).toEqual(detailsByType[type]);
  });

  it.each(schemes)("BANK_TRANSFER %s: scheme is lifted out of the fields and put back", (scheme) => {
    const m = toPaymentMethod(paymentMethodResponseFixture("BANK_TRANSFER", { details: bankDetails[scheme] }));
    expect(m.kind).toBe("bank");
    expect(m.scheme).toBe(scheme);
    expect(m.fields).not.toHaveProperty("scheme");
    expect(toDetails("bank", m.scheme, m.fields)).toEqual(bankDetails[scheme]);
  });

  it("maps the server state onto the view model", () => {
    const m = toPaymentMethod(paymentMethodResponseFixture("RAAST", { isActive: false, isDefault: true, sortOrder: 3, currency: "PKR" }));
    expect(m).toMatchObject({ id: "pm-raast", label: "Raast", enabled: false, isDefault: true, sortOrder: 3, currency: "PKR" });
  });

  it("falls back to IBAN when a bank transfer has no known scheme", () => {
    const m = toPaymentMethod(paymentMethodResponseFixture("BANK_TRANSFER", { details: { ...bankDetails.IBAN, scheme: "WEIRD" } }));
    expect(m.scheme).toBe("IBAN");
  });
});

describe("toDetails", () => {
  it("strips fields the scheme does not use (the server forbids them)", () => {
    const stale = { ...bankDetails.IBAN, routingNumber: "021000021", sortCode: "231470", accountNumber: "1" };
    expect(toDetails("bank", "IBAN", stale)).toEqual(bankDetails.IBAN);
    expect(toDetails("bank", "ACH", stale)).not.toHaveProperty("iban");
  });

  it("strips unknown keys and drops empty or blank values", () => {
    expect(toDetails("jazzcash", undefined, { mobileNumber: " 0300 5550214 ", accountTitle: "  ", nonsense: "x" })).toEqual({ mobileNumber: "0300 5550214" });
  });

  it("passes server-normalised values through unchanged", () => {
    expect(toDetails("esfca", undefined, detailsByType.ESFCA_WIRE).iban).toBe("PK36SCBL0000001123456702");
  });

  it("defaults a bank transfer to the IBAN scheme", () => {
    expect(toDetails("bank", undefined, { iban: "BE68539007547034" }).scheme).toBe("IBAN");
  });
});

describe("toCreate / toUpdate", () => {
  const draft = { kind: "wise" as const, label: "  Wise EUR ", fields: detailsByType.WISE_TO_IBAN };

  it("builds a create body with the API type and trimmed label", () => {
    expect(toCreate(draft)).toEqual({ type: "WISE_TO_IBAN", label: "Wise EUR", details: detailsByType.WISE_TO_IBAN });
    expect(toCreate(draft, true).isDefault).toBe(true);
  });

  it("builds an update body without type", () => {
    const body = toUpdate(draft);
    expect(body).toEqual({ label: "Wise EUR", details: detailsByType.WISE_TO_IBAN });
    expect(body).not.toHaveProperty("type");
  });

  it("every kind's fields are accepted by the matching details", () => {
    for (const k of nonBank) expect(fieldsFor(k).length).toBeGreaterThan(0);
  });
});
