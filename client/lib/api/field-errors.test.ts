import { act, renderHook } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { applyApiFieldErrors } from "./field-errors";

interface Values {
  fullName: string;
  email: string;
  address: { city: string };
}

function axiosError(status: number, data: unknown) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("fail", "ERR", config, null, { status, statusText: "", headers: {}, config, data });
}

function setup() {
  const { result } = renderHook(() => {
    const form = useForm<Values>({ defaultValues: { fullName: "", email: "", address: { city: "" } } });
    void form.formState.errors; // subscribe to error updates
    return form;
  });
  return {
    get form() {
      return result.current;
    },
    apply: (error: unknown) => {
      let handled = false;
      act(() => {
        handled = applyApiFieldErrors(result.current, error);
      });
      return handled;
    },
    get errors() {
      return result.current.formState.errors;
    },
  };
}

describe("applyApiFieldErrors", () => {
  it("maps 422 loc entries onto fields, converting snake_case", () => {
    const t = setup();
    const handled = t.apply(
      axiosError(422, {
        detail: [
          { loc: ["body", "full_name"], msg: "Too short", type: "string_too_short" },
          { loc: ["body", "email"], msg: "Invalid email", type: "value_error" },
          { loc: ["body", "address", "city"], msg: "Required", type: "missing" },
        ],
      }),
    );
    expect(handled).toBe(true);
    expect(t.errors.fullName?.message).toBe("Too short");
    expect(t.errors.email?.message).toBe("Invalid email");
    expect(t.errors.address?.city?.message).toBe("Required");
  });

  it("puts unknown fields on the root error", () => {
    const t = setup();
    t.apply(axiosError(422, { detail: [{ loc: ["body", "mystery"], msg: "Nope", type: "x" }] }));
    expect(t.errors.root?.message).toBe("Nope");
  });

  it("uses the root error for a string detail", () => {
    const t = setup();
    expect(t.apply(axiosError(422, { detail: "Currency not supported" }))).toBe(true);
    expect(t.errors.root?.message).toBe("Currency not supported");
  });

  it("ignores non-422 and non-axios errors", () => {
    const t = setup();
    expect(t.apply(axiosError(409, { detail: "Conflict" }))).toBe(false);
    expect(t.apply(new Error("x"))).toBe(false);
    expect(t.errors.root).toBeUndefined();
  });
});
