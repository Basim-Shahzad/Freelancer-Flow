import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./index";

beforeEach(() => { localStorage.clear(); useAppStore.setState({ online: true }); });

describe("app store", () => {
  it("toggles the online flag and persists nothing", () => {
    useAppStore.getState().setOnline(false);
    expect(useAppStore.getState().online).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(Object.keys(useAppStore.getState()).sort()).toEqual(["online", "setOnline"]);
  });
});
