import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForgotForm } from "./forgot-form";

describe("ForgotForm", () => {
  it("explains that reset is unavailable and cannot be submitted", () => {
    render(<ForgotForm />);
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");
  });
});
