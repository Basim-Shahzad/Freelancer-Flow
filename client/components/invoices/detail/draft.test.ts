import { describe, expect, it } from "vitest";
import { responseToInvoice, toInvoiceUpdate } from "@/lib/api/mappers/invoices";
import { invoiceResponseFixture } from "@/lib/test/invoices";
import { draftChanges, draftDefaults } from "./draft";
import { editDraftSchema } from "./schemas";

const invoice = responseToInvoice(invoiceResponseFixture({ discountRate: "5.00", notes: "Hi", taxNote: null }));

describe("draftChanges (edit-draft round trip)", () => {
  it("starts from the saved invoice and sends nothing when untouched", () => {
    const values = draftDefaults(invoice);
    expect(values).toMatchObject({ discountRate: "5", notes: "Hi", taxMode: "keep", changeMethods: false });
    expect(draftChanges(values, invoice)).toEqual({});
  });

  it("sends only the changed fields, all within InvoiceUpdate's allowed keys", () => {
    const values = { ...draftDefaults(invoice), dueDate: "2026-12-01", discountRate: "12.5", taxMode: "custom" as const, taxName: "VAT", taxRate: "15", notes: "", paymentInstructions: "Pay to X", changeMethods: true, methodIds: ["pm1"] };
    const body = toInvoiceUpdate(draftChanges(values, invoice));
    expect(body).toEqual({
      dueDate: "2026-12-01T00:00:00Z", discountRate: "12.5", notes: null, paymentInstructions: "Pay to X",
      taxes: [{ name: "VAT", rate: "15", isInclusive: false, isCompound: false, isWithholding: false }], paymentMethodIds: ["pm1"],
    });
    const allowed = ["issueDate", "dueDate", "taxes", "taxNote", "discountRate", "notes", "paymentInstructions", "paymentMethodIds"];
    expect(Object.keys(body).every((k) => allowed.includes(k))).toBe(true);
  });

  it("'remove all taxes' sends [] and 'keep' sends no taxes", () => {
    expect(draftChanges({ ...draftDefaults(invoice), taxMode: "none" }, invoice).taxes).toEqual([]);
    expect("taxes" in draftChanges(draftDefaults(invoice), invoice)).toBe(false);
  });
});

describe("editDraftSchema", () => {
  const ok = draftDefaults(invoice);
  it("rejects a due date before the issue date, a bad discount and an unnamed tax", () => {
    const msgs = (v: typeof ok) => { const r = editDraftSchema.safeParse(v); return r.success ? [] : r.error.issues.map((i) => i.message); };
    expect(msgs(ok)).toEqual([]);
    expect(msgs({ ...ok, dueDate: "2000-01-01" }).join()).toMatch(/due date/);
    expect(msgs({ ...ok, discountRate: "150" }).join()).toMatch(/Discount/);
    expect(msgs({ ...ok, taxMode: "custom", taxName: " ", taxRate: "5" }).join()).toMatch(/needs a name/);
    expect(msgs({ ...ok, notes: "x".repeat(5001) }).join()).toMatch(/5000/);
  });
});
