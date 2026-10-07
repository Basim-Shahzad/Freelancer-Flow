"use client";

import { Input, InputAffix } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { fmtDate } from "@/lib/dates";
import type { Currency } from "@/lib/types";
import { dueDateFor, termsLabel, termsOptions } from "./logic";

interface Props {
  currency: Currency;
  tax: string;
  discount: string;
  termsDays: number;
  clientTerms: number;
  issueDate: string;
  error: string | null;
  onTax: (v: string) => void;
  onDiscount: (v: string) => void;
  onTerms: (days: number) => void;
}

export function StepTax({ currency, tax, discount, termsDays, clientTerms, issueDate, error, onTax, onDiscount, onTerms }: Props) {
  const taxErr = error?.startsWith("Tax") ? error : undefined;
  const discErr = error?.startsWith("Discount") ? error : undefined;
  return (
    <section aria-labelledby="ic-3" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2"><h2 id="ic-3" className="t-h2">Tax and discount</h2></div>
      <div className="grid gap-4 @2xl:grid-cols-3">
        <Field label="Tax" htmlFor="ic-tax" error={taxErr}>
          <InputAffix suffix="%"><Input id="ic-tax" inputMode="decimal" value={tax} onChange={(e) => onTax(e.target.value)} aria-invalid={Boolean(taxErr)} /></InputAffix>
        </Field>
        <Field label="Discount" htmlFor="ic-disc" hint="A flat amount taken off before tax." error={discErr}>
          <InputAffix prefix={currency}><Input id="ic-disc" inputMode="decimal" value={discount} onChange={(e) => onDiscount(e.target.value)} aria-invalid={Boolean(discErr)} /></InputAffix>
        </Field>
        <Field label="Payment terms" htmlFor="ic-due" hint={`Due ${fmtDate(dueDateFor(issueDate, termsDays))}`}>
          <SelectField
            id="ic-due" value={String(termsDays)} onValueChange={(v) => onTerms(Number(v))}
            options={termsOptions(clientTerms).map((d) => ({ value: String(d), label: `${termsLabel(d)}${d === clientTerms ? " · client’s terms" : ""} · due ${fmtDate(dueDateFor(issueDate, d))}` }))}
          />
        </Field>
      </div>
      {error && !taxErr && !discErr && <p role="alert" className="text-sm text-error-ink">{error}</p>}
      <Notice>Any tax withheld by your client is recorded when the payment arrives, not on the invoice. Tax figures are informational, not legal or tax advice.</Notice>
    </section>
  );
}
