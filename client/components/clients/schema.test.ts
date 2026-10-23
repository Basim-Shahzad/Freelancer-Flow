import { describe, expect, it } from "vitest";
import { clientSchema, clientToForm, emptyClientForm, formToClient, isValidWhatsapp, termsLabel, waLink } from "./schema";

const valid = { ...emptyClientForm("USD", 14), name: "Jordan Reyes", email: "jordan@harborlabs.example" };

describe("whatsapp helpers", () => {
  it("validates digit counts and characters", () => {
    expect(isValidWhatsapp("")).toBe(true);
    expect(isValidWhatsapp("1 512 555 0142")).toBe(true);
    expect(isValidWhatsapp("03215550188")).toBe(true);
    expect(isValidWhatsapp("+92 (321) 555-0188")).toBe(true);
    expect(isValidWhatsapp("1 512 55")).toBe(false);
    expect(isValidWhatsapp("call me")).toBe(false);
    expect(isValidWhatsapp("1".repeat(16))).toBe(false);
  });
  it("builds wa.me links", () => {
    expect(waLink("+1 512 555 0142")).toBe("https://wa.me/15125550142");
    expect(waLink("")).toBeNull();
  });
});

describe("clientSchema", () => {
  it("accepts a minimal valid client", () => {
    expect(clientSchema.safeParse(valid).success).toBe(true);
  });
  it("requires name and a valid email", () => {
    const r = clientSchema.safeParse({ ...valid, name: " ", email: "nope" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["email", "name"]);
  });
  it("rejects a short whatsapp number", () => {
    expect(clientSchema.safeParse({ ...valid, whatsapp: "1 512 55" }).success).toBe(false);
  });
});

describe("form conversions", () => {
  it("converts strings to the domain shape and leaves the WhatsApp number for the server to normalise", () => {
    const c = formToClient({ ...valid, whatsapp: " 03215550188 ", termsDays: "30", companyName: " Harbor " });
    expect(c).toMatchObject({ whatsapp: "03215550188", termsDays: 30, companyName: "Harbor" });
  });
  it("round-trips a client through the form", () => {
    const input = { name: "A", companyName: "B", email: "a@b.co", phone: "1", whatsapp: "+923215550188", address: "X", taxId: "T", currency: "PKR" as const, termsDays: 0, notes: "n" };
    expect(formToClient(clientToForm({ ...input, id: "c1", createdAt: "" }))).toEqual(input);
  });
  it("labels terms", () => {
    expect(termsLabel(0)).toBe("Due on receipt");
    expect(termsLabel(14)).toBe("Net 14");
  });
});
