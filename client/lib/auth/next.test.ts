import { describe, expect, it } from "vitest";
import { loginUrl, onboardingUrl, safeNext } from "./next";

describe("safeNext", () => {
  it.each(["/dashboard", "/projects/abc?tab=time", "/settings/account#x"])("accepts %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([null, undefined, "", "dashboard", "//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "/a\nb"])("rejects %j", (p) => {
    expect(safeNext(p)).toBeNull();
  });
});

describe("loginUrl", () => {
  it("encodes the target", () => {
    expect(loginUrl("/projects?x=1")).toBe("/login?next=%2Fprojects%3Fx%3D1");
  });

  it("omits next for unsafe or auth-page targets", () => {
    expect(loginUrl("//evil.com")).toBe("/login");
    expect(loginUrl("/login")).toBe("/login");
    expect(loginUrl("/onboarding")).toBe("/login");
    expect(loginUrl(null)).toBe("/login");
  });
});

describe("onboardingUrl", () => {
  it("encodes the target", () => {
    expect(onboardingUrl("/projects?x=1")).toBe("/onboarding?next=%2Fprojects%3Fx%3D1");
  });

  it("omits next for unsafe or auth-page targets", () => {
    expect(onboardingUrl("//evil.com")).toBe("/onboarding");
    expect(onboardingUrl("/login")).toBe("/onboarding");
    expect(onboardingUrl(undefined)).toBe("/onboarding");
  });
});
