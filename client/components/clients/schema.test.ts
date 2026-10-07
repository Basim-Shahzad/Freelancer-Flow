import { describe, expect, it } from "vitest";
import { clientSchema, emptyClientForm, formToClient, isValidWhatsapp, normalizeWhatsapp, termsLabel, waLink } from "./schema";

const valid = { ...emptyClientForm("USD", 14), name: "Harbor Labs", email: "jordan@harborlabs.example" };

describe("whatsapp helpers", () => {
  it("validates digit counts and characters", () => {
    expect(isValidWhatsapp("")).toBe(true);
    expect(isValidWhatsapp("1 512 555 0142")).toBe(true);
    expect(isValidWhatsapp("+92 (321) 555-0188")).toBe(true);
    expect(isValidWhatsapp("1 512 55")).toBe(false);
    expect(isValidWhatsapp("call me")).toBe(false);
    expect(isValidWhatsapp("1".repeat(16))).toBe(false);
  });
  it("normalizes to a single leading plus", () => {
    expect(normalizeWhatsapp("  92   321 5550188 ")).toBe("+92 321 5550188");
    expect(normalizeWhatsapp("++1 (512) 555-0142")).toBe("+1 512 5550142");
    expect(normalizeWhatsapp("")).toBe("");
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

describe("formToClient", () => {
  it("converts strings to the domain shape and drops unknown methods", () => {
    const c = formToClient({ ...valid, whatsapp: "92 321 5550188", termsDays: "30", prefersMethods: ["raast", "bogus"] });
    expect(c).toMatchObject({ whatsapp: "+92 321 5550188", termsDays: 30, prefersMethods: ["raast"] });
  });
  it("labels terms", () => {
    expect(termsLabel(0)).toBe("Due on receipt");
    expect(termsLabel(14)).toBe("Net 14");
  });
});
