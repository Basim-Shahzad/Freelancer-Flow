import { describe, expect, it } from "vitest";
import { BANK_SCHEME_ORDER, BANK_SCHEMES, METHOD_KINDS, defaultLabel, fieldsFor, maskValue, methodSummary, methodTitle } from "./payment-methods";
import { methodFixtures } from "./test/payment-methods";
import type { BankScheme } from "./types";

/** Mirrors `BANK_SCHEMES` in server/app/schemas/PaymentMethodSchema.py: `[all accepted keys, required keys]`. */
const SERVER_SCHEMES: Record<BankScheme, [string[], string[]]> = {
  IBAN: [["iban", "swiftBic"], ["iban"]],
  ACH: [["routingNumber", "accountNumber", "accountType"], ["routingNumber", "accountNumber", "accountType"]],
  UK_SORT_CODE: [["sortCode", "accountNumber"], ["sortCode", "accountNumber"]],
  SWIFT_OTHER: [["accountNumber", "swiftBic", "branchCode"], ["accountNumber", "swiftBic"]],
};

describe("bank schemes", () => {
  it.each(BANK_SCHEME_ORDER)("%s matches the server's fields and required set", (scheme) => {
    const [keys, required] = SERVER_SCHEMES[scheme];
    const fields = BANK_SCHEMES[scheme].fields;
    expect(fields.map((f) => f.key).sort()).toEqual([...keys].sort());
    expect(fields.filter((f) => f.required).map((f) => f.key).sort()).toEqual([...required].sort());
  });

  it("has an entry in the order list for every scheme", () => {
    expect([...BANK_SCHEME_ORDER].sort()).toEqual(Object.keys(BANK_SCHEMES).sort());
  });

  it("adds the common bank fields to every scheme", () => {
    const keys = fieldsFor("bank", "ACH").map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["accountHolder", "bankName", "country", "currency", "routingNumber"]));
    expect(keys).not.toContain("iban");
  });
});

describe("kinds", () => {
  // key -> required, per the server's *Details models
  const SERVER: Record<string, string[]> = {
    payoneer: [],
    esfca: ["beneficiaryName", "bankName", "iban", "swiftBic", "bankAddress"],
    elevate: ["accountHolder", "accountNumber", "routingNumber", "bankName", "accountType"],
    wise: ["beneficiaryName", "iban", "bankName"],
    pkrbank: ["accountTitle", "bankName", "iban"],
    raast: ["accountTitle"],
    jazzcash: ["mobileNumber", "accountTitle"],
    easypaisa: ["mobileNumber", "accountTitle"],
    other: ["instructions"],
  };

  it.each(Object.entries(SERVER))("%s requires what the server requires", (kind, required) => {
    const fields = METHOD_KINDS[kind as keyof typeof METHOD_KINDS].fields;
    expect(fields.filter((f) => f.required).map((f) => f.key).sort()).toEqual([...required].sort());
  });

  it("models the server's 'one of' rules", () => {
    expect(METHOD_KINDS.payoneer.requireOneOf).toEqual(["accountEmail", "paymentRequestUrl"]);
    expect(METHOD_KINDS.raast.requireOneOf).toEqual(["raastId", "iban"]);
  });
});

describe("titles and summaries", () => {
  const byKind = Object.fromEntries(methodFixtures().map((m) => [m.kind, m]));

  it("uses the label, else the kind's default", () => {
    expect(methodTitle({ kind: "wise", label: "Wise EUR" })).toBe("Wise EUR");
    expect(methodTitle({ kind: "wise", label: " " })).toBe("Wise (to IBAN)");
    expect(defaultLabel("bank", "UK_SORT_CODE")).toBe("Bank transfer · UK sort code");
  });

  it("summarises with the last 4 characters only", () => {
    expect(methodSummary(byKind.pkrbank!)).toBe("HBL · IBAN ending 6702");
    expect(methodSummary(byKind.raast!)).toBe("Raast ID ending 0214");
    expect(methodSummary(byKind.payoneer!)).toBe("ayesha@maliks.studio");
  });

  it("masks values", () => {
    expect(maskValue("PK36 SCBL 0000 0011 2345 6702")).toBe("PK36 •••• 6702");
    expect(maskValue("123")).toBe("••••");
  });
});
