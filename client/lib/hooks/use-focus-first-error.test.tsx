import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { firstErrorName, useFocusFirstError } from "./use-focus-first-error";

describe("firstErrorName", () => {
  it("returns the first leaf and skips root", () => {
    expect(firstErrorName({ root: { type: "server", message: "x" }, a: { b: { type: "x", message: "m" } } } as never)).toBe("a.b");
    expect(firstErrorName({})).toBeNull();
  });
});

function Form({ failServer = false }: { failServer?: boolean }) {
  const form = useForm<{ name: string; email: string }>({ defaultValues: { name: "x", email: "" } });
  useFocusFirstError(form);
  return (
    <form onSubmit={form.handleSubmit(() => { if (failServer) form.setError("email", { type: "server", message: "taken" }); })}>
      <input aria-label="Name" {...form.register("name")} />
      <input aria-label="Email" aria-invalid={!!form.formState.errors.email} {...form.register("email", { required: !failServer && "Required" })} />
      <button type="submit">Go</button>
    </form>
  );
}

describe("useFocusFirstError", () => {
  it("focuses the first invalid input after a failed submit", async () => {
    render(<Form />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });
  it("focuses a field flagged by a server (422-style) error", async () => {
    render(<Form failServer />);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });
  it("does nothing before any submit", () => {
    const { result } = renderHook(() => { const f = useForm(); useFocusFirstError(f); return f; });
    act(() => undefined);
    expect(result.current.formState.submitCount).toBe(0);
  });
});
