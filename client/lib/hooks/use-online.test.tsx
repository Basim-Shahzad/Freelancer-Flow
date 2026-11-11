import { act, renderHook } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";
import { useOnlineSync } from "./use-online";

describe("useOnlineSync", () => {
  it("keeps store and onlineManager in step with window events", () => {
    renderHook(() => useOnlineSync());
    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(useAppStore.getState().online).toBe(false);
    expect(onlineManager.isOnline()).toBe(false);
    act(() => { window.dispatchEvent(new Event("online")); });
    expect(useAppStore.getState().online).toBe(true);
    expect(onlineManager.isOnline()).toBe(true);
  });
});
