"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { PaymentMethodForm, type MethodDraft } from "@/components/domain/payment-method-form";
import { Button } from "@/components/ui/button";
import { Checkbox, ChoiceRow } from "@/components/ui/checkbox";
import { Notice } from "@/components/ui/notice";
import { METHOD_KINDS } from "@/lib/payment-methods";
import type { PaymentMethodKind } from "@/lib/types";
import { validateMethods, type MethodsValues } from "../onboarding-logic";
import { StepActions } from "./step-actions";

const GROUPS: { label: string; kinds: PaymentMethodKind[] }[] = [
  { label: "International", kinds: ["payoneer", "esfca", "elevate", "wise"] },
  { label: "Pakistan, in rupees", kinds: ["pkrbank", "raast", "jazzcash", "easypaisa"] },
  { label: "Other", kinds: ["bank", "other"] },
];

const BLURB: Partial<Record<PaymentMethodKind, string>> = {
  payoneer: "Receiving details or a payment-request link",
  esfca: "USD wire to your Exporters’ Special Foreign Currency Account",
  elevate: "USD account details",
  wise: "Client sends via Wise to your bank account",
  pkrbank: "IBAN, bank and branch",
  raast: "Raast ID or IBAN",
  jazzcash: "Wallet number",
  easypaisa: "Wallet number",
  bank: "IBAN, ACH, UK sort code or SWIFT",
  other: "Your own wording",
};

export function MethodsStep({ value, onChange, onBack, onNext, onSkip }: {
  value: MethodsValues; onChange: (v: MethodsValues) => void; onBack: () => void; onNext: () => void; onSkip: () => void;
}) {
  const [active, setActive] = useState<PaymentMethodKind | undefined>(value.selected[0]);
  const [error, setError] = useState<string | null>(null);
  const current = active && value.selected.includes(active) ? active : value.selected[0];

  const toggle = (k: PaymentMethodKind, on: boolean) => {
    setError(null);
    if (on) { onChange({ ...value, selected: [...value.selected, k] }); setActive(k); return; }
    onChange({ ...value, selected: value.selected.filter((x) => x !== k), saved: value.saved.filter((x) => x !== k) });
  };
  const draft = (k: PaymentMethodKind, d: MethodDraft, saved: boolean) =>
    onChange({ ...value, drafts: { ...value.drafts, [k]: d }, saved: saved ? [...new Set([...value.saved, k])] : value.saved.filter((x) => x !== k) });

  const next = () => {
    const r = validateMethods(value);
    if (r.ok) { onNext(); return; }
    setError(r.message);
    if (r.firstMissing) setActive(r.firstMissing);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(21rem,100%),1fr))] gap-10">
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => (
            <fieldset key={g.label} className="m-0 border-0 p-0">
              <legend className="t-eyebrow mb-1.5 p-0">{g.label}</legend>
              <div className="border-t border-border">
                {g.kinds.map((k) => (
                  <ChoiceRow key={k}>
                    <Checkbox className="mt-0.5" checked={value.selected.includes(k)} onCheckedChange={(c) => toggle(k, c === true)} />
                    <span><span className="font-medium">{METHOD_KINDS[k].label}</span><br /><span className="t-caption">{BLURB[k]}</span></span>
                  </ChoiceRow>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="flex flex-col gap-5 self-start">
          {current ? (
            <>
              <div className="flex flex-col gap-2.5">
                <span className="t-eyebrow" id="ob-add-details">Add details for</span>
                <div role="group" aria-labelledby="ob-add-details" className="flex flex-wrap gap-2">
                  {value.selected.map((k) => (
                    <Button key={k} size="sm" variant="outline" aria-pressed={k === current} className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background" onClick={() => setActive(k)}>
                      {METHOD_KINDS[k].label}
                      {value.saved.includes(k) && <><Check aria-hidden="true" /><span className="sr-only">(saved)</span></>}
                    </Button>
                  ))}
                </div>
              </div>
              <hr className="m-0 border-0 border-t border-rule" />
              <PaymentMethodForm
                key={current}
                kind={current}
                initial={value.drafts[current]}
                submitLabel={value.saved.includes(current) ? "Details saved" : "Save details"}
                onChange={(d) => draft(current, d, false)}
                onSubmit={(d) => { setError(null); draft(current, d, true); }}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground [text-wrap:pretty]">
              Pick at least one method to add its details. You can skip this and add methods later in Settings, but invoices need one before they can be sent.
            </p>
          )}
        </div>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <StepActions onBack={onBack} onSkip={onSkip}>
        <Button onClick={next}>Continue</Button>
      </StepActions>
    </div>
  );
}
