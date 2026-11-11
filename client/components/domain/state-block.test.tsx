import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/lib/test";
import { StateBlock } from "./state-block";

describe("StateBlock", () => {
  it("rateLimited uses status semantics and default copy", () => {
    renderWithProviders(<StateBlock kind="rateLimited" />);
    expect(screen.getByRole("status")).toHaveTextContent("Too many requests");
  });
  it("server is announced as an alert", () => {
    renderWithProviders(<StateBlock kind="server" />);
    expect(screen.getByRole("alert")).toHaveTextContent("server had a problem");
  });
});
