import { describe, expect, it } from "vitest";
import { fieldsFor } from "@/lib/payment-methods";
import { mapMethodErrors } from "./payment-method-errors";

const err = (status: number, data: unknown) => Object.assign(new Error("x"), { isAxiosError: true, response: { status, data } });
const unprocessable = (msg: string, loc: (string | number)[] = ["body"]) => err(422, { detail: [{ loc, msg, type: "value_error" }] });
const keys = (kind: Parameters<typeof fieldsFor>[0], scheme?: Parameters<typeof fieldsFor>[1]) => [...fieldsFor(kind, scheme).map((f) => f.key), "label"];

describe("mapMethodErrors", () => {
  it("ignores anything that is not a 422", () => {
    expect(mapMethodErrors(err(409, { detail: "conflict" }))).toBeNull();
    expect(mapMethodErrors(new Error("offline"))).toBeNull();
  });

  it("maps a bad IBAN", () => {
    const r = mapMethodErrors(unprocessable("Value error, iban: invalid IBAN checksum"), keys("wise"));
    expect(r).toEqual({ fields: { iban: "Invalid IBAN checksum" }, general: undefined });
  });

  it("maps a bad ABA routing number (snake_case -> camelCase)", () => {
    const r = mapMethodErrors(unprocessable("Value error, routing_number: invalid ABA routing number"), keys("bank", "ACH"));
    expect(r?.fields).toEqual({ routingNumber: "Invalid ABA routing number" });
  });

  it("maps a malformed sort code", () => {
    const r = mapMethodErrors(unprocessable("Value error, sort_code: sort code must be 6 digits"), keys("bank", "UK_SORT_CODE"));
    expect(r?.fields).toEqual({ sortCode: "Sort code must be 6 digits" });
  });

  it("maps a missing swiftBic under SWIFT_OTHER", () => {
    const r = mapMethodErrors(unprocessable("Value error, swift_bic is required for scheme SWIFT_OTHER"), keys("bank", "SWIFT_OTHER"));
    expect(r?.fields).toEqual({ swiftBic: "Required for this account type" });
  });

  it("maps a bad PK mobile number", () => {
    const r = mapMethodErrors(unprocessable("Value error, mobileNumber: not a valid Pakistani mobile number"), keys("jazzcash"));
    expect(r?.fields).toEqual({ mobileNumber: "Not a valid Pakistani mobile number" });
  });

  it("splits several problems from one message", () => {
    const r = mapMethodErrors(unprocessable("Value error, iban: invalid IBAN checksum; swift_bic is required for scheme IBAN; routing_number is not used by scheme IBAN"), keys("bank", "IBAN"));
    expect(r?.fields).toEqual({ iban: "Invalid IBAN checksum", swiftBic: "Required for this account type" });
    // routingNumber is not a field of the IBAN scheme, so it cannot sit under an input.
    expect(r?.general).toBe("Not used by this account type");
  });

  it("uses the loc when the message names no field", () => {
    const r = mapMethodErrors(unprocessable("String should have at least 1 character", ["body", "label"]), keys("wise"));
    expect(r?.fields).toEqual({ label: "String should have at least 1 character" });
  });

  it("keeps messages without a field as the general error", () => {
    const r = mapMethodErrors(unprocessable("Value error, details: provide raastId or iban"), keys("raast"));
    expect(r).toEqual({ fields: {}, general: "Provide raastId or iban" });
  });

  it("reads a plain string detail (e.g. from PATCH)", () => {
    const r = mapMethodErrors(err(422, { detail: "iban: invalid IBAN checksum" }), keys("wise"));
    expect(r?.fields).toEqual({ iban: "Invalid IBAN checksum" });
  });

  it("accepts any key when none are given", () => {
    expect(mapMethodErrors(unprocessable("x_y: bad"))?.fields).toEqual({ xY: "Bad" });
  });
});
