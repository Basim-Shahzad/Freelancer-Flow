import { describe, expect, it } from "vitest";
import { cleanParams, hasMore, nextSkip, pageToSkip, toListResult } from "./pagination";

describe("pagination helpers", () => {
  it("pageToSkip is 1-based", () => {
    expect(pageToSkip(1, 20)).toBe(0);
    expect(pageToSkip(3, 20)).toBe(40);
    expect(pageToSkip(0, 20)).toBe(0);
  });

  it("hasMore compares loaded to total", () => {
    expect(hasMore(20, 45)).toBe(true);
    expect(hasMore(45, 45)).toBe(false);
  });

  it("nextSkip returns the loaded count until total is reached", () => {
    const p1 = { items: new Array(20).fill(0), total: 45 };
    const p2 = { items: new Array(20).fill(0), total: 45 };
    const p3 = { items: new Array(5).fill(0), total: 45 };
    expect(nextSkip(p1, [p1])).toBe(20);
    expect(nextSkip(p2, [p1, p2])).toBe(40);
    expect(nextSkip(p3, [p1, p2, p3])).toBeUndefined();
  });

  it("nextSkip stops on an empty page", () => {
    const empty = { items: [], total: 10 };
    expect(nextSkip(empty, [empty])).toBeUndefined();
  });

  it("cleanParams drops empty values but keeps 0 and false", () => {
    expect(cleanParams({ search: "", status: undefined, skip: 0, limit: null, flag: false, q: "a" })).toEqual({ skip: 0, flag: false, q: "a" });
  });

  it("toListResult unwraps the items key", () => {
    expect(toListResult({ clients: [{ id: 1 }], total: 7 }, "clients")).toEqual({ items: [{ id: 1 }], total: 7 });
  });
});
