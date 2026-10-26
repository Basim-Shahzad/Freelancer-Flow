import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FxRatesProvider } from "@/lib/hooks/exchange-rates";
import { fxRatesFixture } from "@/lib/test/exchange-rates";
import { Money } from "./money";

const rates = fxRatesFixture();

describe("<Money estimateIn>", () => {
  it("shows a labelled estimate with the real date and source", () => {
    render(<FxRatesProvider rates={rates}><Money amount={125000} currency="USD" estimateIn="PKR" /></FxRatesProvider>);
    expect(screen.getByText("PKR 3,483")).toBeTruthy(); // formatAmount divides every minor unit by 100
    expect(screen.getByText(/≈ estimate · ref\. rate 20 Oct 2026/)).toBeTruthy();
    expect(screen.getByText(/State Bank of Pakistan/)).toBeTruthy();
  });

  it("shows the real, older date for stale rates", () => {
    render(<FxRatesProvider rates={fxRatesFixture({ asOf: "2026-01-02" })}><Money amount={125000} currency="USD" estimateIn="PKR" /></FxRatesProvider>);
    expect(screen.getByText(/ref\. rate 02 Jan 2026/)).toBeTruthy();
  });

  it("says the date is unavailable rather than using today", () => {
    render(<FxRatesProvider rates={fxRatesFixture({ asOf: null })}><Money amount={125000} currency="USD" estimateIn="PKR" /></FxRatesProvider>);
    expect(screen.getByText(/date unavailable/)).toBeTruthy();
  });

  it("shows no estimate without rates", () => {
    render(<Money amount={125000} currency="USD" estimateIn="PKR" note />);
    expect(screen.queryByText(/estimate/)).toBeNull();
    expect(screen.queryByText(/Reference rate only/)).toBeNull();
  });

  it("shows no estimate for an unsupported currency pair", () => {
    render(<FxRatesProvider rates={rates}><Money amount={125000} currency="EUR" estimateIn="PKR" /></FxRatesProvider>);
    expect(screen.queryByText(/estimate/)).toBeNull();
  });

  it("shows the disclaimer when note is set", () => {
    render(<FxRatesProvider rates={rates}><Money amount={125000} currency="USD" estimateIn="PKR" note /></FxRatesProvider>);
    expect(screen.getByText("Reference rate only; the actual rate is set by your bank or provider.")).toBeTruthy();
  });

  it("lets the rates prop override the context", () => {
    render(<FxRatesProvider rates={null}><Money amount={125000} currency="USD" estimateIn="PKR" rates={rates} /></FxRatesProvider>);
    expect(screen.getByText(/≈ estimate/)).toBeTruthy();
  });

  it("shows nothing for a zero amount", () => {
    render(<FxRatesProvider rates={rates}><Money amount={0} currency="USD" estimateIn="PKR" /></FxRatesProvider>);
    expect(screen.queryByText(/estimate/)).toBeNull();
  });
});
