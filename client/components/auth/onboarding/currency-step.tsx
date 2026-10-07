"use client";

import { Money } from "@/components/domain/money";
import { ChoiceRow } from "@/components/ui/checkbox";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";
import type { Currency } from "@/lib/types";
import { estimateCurrency, previewAmount } from "../onboarding-logic";
import { DISPLAY_CHOICES, type CurrencyValues, type DisplayChoice } from "../schemas";
import { StepActions } from "./step-actions";

const INVOICE: { value: Currency; title: string; desc: string }[] = [
  { value: "USD", title: "US dollar", desc: "For clients abroad: Austin, Dubai, London" },
  { value: "PKR", title: "Pakistani rupee", desc: "For clients in Pakistan" },
  { value: "EUR", title: "Euro", desc: "For clients in Europe" },
  { value: "GBP", title: "British pound", desc: "For clients in the United Kingdom" },
  { value: "AED", title: "UAE dirham", desc: "For clients in the Gulf" },
];

const DISPLAY: Record<DisplayChoice, { title: string; desc: string }> = {
  both: { title: "PKR and USD together", desc: "Recommended. Every figure shows its converted estimate beneath." },
  usd: { title: "USD only", desc: "Estimates shown in dollars" },
  pkr: { title: "PKR only", desc: "Estimates shown in rupees" },
};

export function CurrencyStep({ value, onChange, onBack, onNext }: {
  value: CurrencyValues; onChange: (v: CurrencyValues) => void; onBack: () => void; onNext: () => void;
}) {
  const est = estimateCurrency(value.invoiceCurrency, value.display);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }} aria-label="Currency" className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))] gap-10">
        <div className="flex flex-col gap-7">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-semibold">Default invoice currency</legend>
            <RadioGroup value={value.invoiceCurrency} onValueChange={(v) => onChange({ ...value, invoiceCurrency: v as Currency })} aria-label="Default invoice currency" className="border-t border-border">
              {INVOICE.map((c) => (
                <ChoiceRow key={c.value}>
                  <RadioItem value={c.value} />
                  <span><span className="font-medium">{c.title}</span><br /><span className="t-caption">{c.desc}</span></span>
                </ChoiceRow>
              ))}
            </RadioGroup>
            <p className="mt-2 text-xs text-muted-foreground">You can still pick a different currency on each invoice.</p>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-semibold">Display currency</legend>
            <RadioGroup value={value.display} onValueChange={(v) => onChange({ ...value, display: v as DisplayChoice })} aria-label="Display currency" className="border-t border-border">
              {DISPLAY_CHOICES.map((d) => (
                <ChoiceRow key={d}>
                  <RadioItem value={d} />
                  <span><span className="font-medium">{DISPLAY[d].title}</span><br /><span className="t-caption">{DISPLAY[d].desc}</span></span>
                </ChoiceRow>
              ))}
            </RadioGroup>
          </fieldset>
        </div>
        <div className="flex flex-col gap-3 self-start">
          <span className="t-eyebrow">Preview</span>
          <hr className="m-0 border-0 border-t border-rule" />
          <Money size="hero" currency={value.invoiceCurrency} amount={previewAmount(value.invoiceCurrency)} estimateIn={est} note={!!est} />
        </div>
      </div>
      <StepActions onBack={onBack} primary="Continue" />
    </form>
  );
}
