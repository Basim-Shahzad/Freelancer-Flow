import { describe, expect, it } from "vitest";
import { clearLegacyStore } from "./providers";

describe("clearLegacyStore", () => {
  it("removes the stale paylancr-v1 mock store and leaves other keys", () => {
    localStorage.setItem("paylancr-v1", "{}");
    localStorage.setItem("paylancr-time-outbox", "[]");
    clearLegacyStore();
    expect(localStorage.getItem("paylancr-v1")).toBeNull();
    expect(localStorage.getItem("paylancr-time-outbox")).toBe("[]");
  });
});
