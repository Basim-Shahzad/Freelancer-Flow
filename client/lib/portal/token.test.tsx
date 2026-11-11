import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPortalTokens, usePortalToken } from "./token";

describe("usePortalToken", () => {
  beforeEach(() => { resetPortalTokens(); window.history.replaceState(null, "", "/i/abc?token=jwt.value&x=1"); });
  afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

  it("reads the token and strips it from the URL", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => usePortalToken());
    expect(result.current).toBe("jwt.value");
    expect(spy).toHaveBeenCalled();
    expect(window.location.search).toBe("?x=1");
  });

  it("does not touch storage and keeps the token after the strip", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    const first = renderHook(() => usePortalToken());
    const second = renderHook(() => usePortalToken());
    expect(first.result.current).toBe("jwt.value");
    expect(second.result.current).toBe("jwt.value");
    expect(set).not.toHaveBeenCalled();
  });

  it("returns null without a token", () => {
    window.history.replaceState(null, "", "/i/other");
    expect(renderHook(() => usePortalToken()).result.current).toBeNull();
  });
});
