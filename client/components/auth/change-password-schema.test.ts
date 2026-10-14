import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./schemas";

const parse = (v: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>) =>
  changePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password", ...v });

const messages = (r: ReturnType<typeof parse>) => (r.success ? [] : r.error.issues.map((i) => i.message));

describe("changePasswordSchema", () => {
  it("accepts a valid change", () => expect(parse({}).success).toBe(true));
  it("requires the current password", () => expect(messages(parse({ currentPassword: "" }))).toContain("Enter your current password."));
  it("requires 8+ characters", () => expect(messages(parse({ newPassword: "short", confirmPassword: "short" }))).toContain("Use 8 characters or more."));
  it("caps at 128 characters", () => {
    const long = "a".repeat(129);
    expect(messages(parse({ newPassword: long, confirmPassword: long }))).toContain("Use 128 characters or fewer.");
  });
  it("rejects reusing the current password", () => {
    expect(messages(parse({ newPassword: "old-password", confirmPassword: "old-password" }))).toContain("Choose a password different from your current one.");
  });
  it("requires the confirmation to match", () => expect(messages(parse({ confirmPassword: "different" }))).toContain("The passwords don’t match."));
});
