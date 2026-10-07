import { describe, expect, it } from "vitest";
import { businessSchema, clientSchema, forgotSchema, isClientBlank, logInSchema, signUpSchema } from "./schemas";

const okSignUp = { name: "Ayesha Malik", email: "ayesha@maliks.studio", password: "correct horse", country: "PK", terms: true };

describe("signUpSchema", () => {
  it("accepts valid input", () => expect(signUpSchema.safeParse(okSignUp).success).toBe(true));
  it("requires 10+ char password", () => {
    const r = signUpSchema.safeParse({ ...okSignUp, password: "short" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Use 10 characters or more.");
  });
  it("rejects a bad email and unticked terms", () => {
    const r = signUpSchema.safeParse({ ...okSignUp, email: "nope", terms: false });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["email", "terms"]);
  });
  it("trims the email", () => expect(signUpSchema.parse({ ...okSignUp, email: "  a@b.co " }).email).toBe("a@b.co"));
});

describe("logIn / forgot", () => {
  it("login needs email and password", () => {
    expect(logInSchema.safeParse({ email: "", password: "", keep: true }).success).toBe(false);
    expect(logInSchema.safeParse({ email: "a@b.co", password: "x", keep: false }).success).toBe(true);
  });
  it("forgot validates the email", () => {
    expect(forgotSchema.safeParse({ email: "a@b" }).success).toBe(false);
    expect(forgotSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});

describe("businessSchema", () => {
  const ok = { businessName: "Malik Studio", ownerName: "Ayesha", country: "PK", city: "Lahore", address: "", taxId: "" };
  it("accepts a minimal profile", () => expect(businessSchema.safeParse(ok).success).toBe(true));
  it("validates NTN only when provided", () => {
    expect(businessSchema.safeParse({ ...ok, taxId: "1234567-8" }).success).toBe(true);
    expect(businessSchema.safeParse({ ...ok, taxId: "12345678" }).success).toBe(true);
    expect(businessSchema.safeParse({ ...ok, taxId: "abc" }).success).toBe(false);
  });
  it("requires name and city", () => {
    const r = businessSchema.safeParse({ ...ok, businessName: "", city: "" });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["businessName", "city"]);
  });
});

describe("clientSchema (skippable)", () => {
  const blank = { contactName: "", company: "", email: "", whatsapp: "", city: "", currency: "USD" };
  it("passes when untouched", () => {
    expect(clientSchema.safeParse(blank).success).toBe(true);
    expect(isClientBlank(blank)).toBe(true);
  });
  it("requires contact name and email once anything is typed", () => {
    const r = clientSchema.safeParse({ ...blank, company: "Gulberg Textiles" });
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["contactName", "email"]);
  });
  it("validates email and whatsapp format", () => {
    const base = { ...blank, contactName: "Hamza", email: "hamza@x.example" };
    expect(clientSchema.safeParse({ ...base, whatsapp: "92 321 4567890" }).success).toBe(true);
    expect(clientSchema.safeParse({ ...base, whatsapp: "12" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, email: "hamza" }).success).toBe(false);
  });
});
