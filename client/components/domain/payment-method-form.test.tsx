import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { detailsByType } from "@/lib/test/payment-methods";
import { PaymentMethodForm, validateMethodDraft } from "./payment-method-form";

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: /save/i }));

describe("validateMethodDraft", () => {
  it("requires a name and the kind's required fields", () => {
    const errs = validateMethodDraft({ kind: "pkrbank", label: "", fields: {} });
    expect(Object.keys(errs).sort()).toEqual(["accountTitle", "bankName", "iban", "label"]);
  });

  it("requires a name for Other", () => {
    expect(validateMethodDraft({ kind: "other", label: " ", fields: { instructions: "Pay in cash" } })).toEqual({ label: "Name is required" });
  });

  it("accepts either half of an 'and/or' pair", () => {
    expect(validateMethodDraft({ kind: "payoneer", label: "Payoneer", fields: {} }).accountEmail).toMatch(/Payoneer email or Payment request link/);
    expect(validateMethodDraft({ kind: "payoneer", label: "Payoneer", fields: { paymentRequestUrl: "https://x.example" } })).toEqual({});
    expect(validateMethodDraft({ kind: "raast", label: "Raast", fields: { accountTitle: "A", iban: "PK36HABB0000001123456702" } })).toEqual({});
  });

  it("checks the fields of the chosen scheme only", () => {
    const base = { accountHolder: "A", bankName: "B", country: "US", currency: "USD" };
    expect(validateMethodDraft({ kind: "bank", scheme: "IBAN", label: "B", fields: { ...base, iban: "BE68539007547034" } })).toEqual({});
    expect(Object.keys(validateMethodDraft({ kind: "bank", scheme: "ACH", label: "B", fields: base })).sort()).toEqual(["accountNumber", "accountType", "routingNumber"]);
  });
});

describe("PaymentMethodForm", () => {
  it("starts with the kind's name and submits the draft", () => {
    const onSubmit = vi.fn();
    render(<PaymentMethodForm kind="jazzcash" onSubmit={onSubmit} />);
    expect(screen.getByLabelText("Name")).toHaveValue("JazzCash");
    type("Wallet number", "0300 5550214");
    type("Account title", "Ayesha Malik");
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ kind: "jazzcash", scheme: undefined, label: "JazzCash", fields: { mobileNumber: "0300 5550214", accountTitle: "Ayesha Malik" } });
  });

  it("does not submit while required fields are empty, and clears an error on edit", () => {
    const onSubmit = vi.fn();
    render(<PaymentMethodForm kind="jazzcash" onSubmit={onSubmit} />);
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Wallet number is required")).toBeTruthy();
    type("Wallet number", "0300");
    expect(screen.queryByText("Wallet number is required")).toBeNull();
  });

  it("leaves the name of an Other method empty and required", () => {
    render(<PaymentMethodForm kind="other" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Name")).toHaveValue("");
    type("Instructions", "Pay in cash");
    submit();
    expect(screen.getByText("Name is required")).toBeTruthy();
  });

  it("changes the fields when the bank scheme changes, and keeps an untouched default name in step", () => {
    const onChange = vi.fn();
    render(<PaymentMethodForm kind="bank" onSubmit={vi.fn()} onChange={onChange} />);
    expect(screen.getByLabelText(/^IBAN/)).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("Bank transfer · IBAN");
    fireEvent.click(screen.getByRole("button", { name: "UK sort code" }));
    expect(screen.queryByLabelText(/^IBAN/)).toBeNull();
    expect(screen.getByLabelText(/^Sort code/)).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("Bank transfer · UK sort code");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scheme: "UK_SORT_CODE", label: "Bank transfer · UK sort code" }));
  });

  it("shows the server's normalised values when a method is re-opened", () => {
    render(<PaymentMethodForm kind="esfca" initial={{ label: "ESFCA", fields: detailsByType.ESFCA_WIRE }} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^IBAN/)).toHaveValue("PK36SCBL0000001123456702");
  });

  it("shows server errors under their fields and in a general notice, and clears one when edited", () => {
    const errors = { fields: { iban: "Invalid IBAN checksum" }, general: "Something else is wrong" };
    render(<PaymentMethodForm kind="wise" initial={{ label: "Wise", fields: detailsByType.WISE_TO_IBAN }} errors={errors} onSubmit={vi.fn()} />);
    expect(screen.getByText("Invalid IBAN checksum")).toBeTruthy();
    expect(screen.getByText("Something else is wrong")).toBeTruthy();
    type(/^IBAN/, "BE71096123456769");
    expect(screen.queryByText("Invalid IBAN checksum")).toBeNull();
  });

  it("disables saving while a save is in flight", () => {
    render(<PaymentMethodForm kind="other" submitting onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
