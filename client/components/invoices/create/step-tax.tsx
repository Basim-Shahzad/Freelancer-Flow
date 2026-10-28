"use client";

import { Input, InputAffix } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/dates";
import { INSTRUCTIONS_MAX, NOTES_MAX, dueDateFor, termsLabel, termsOptions, type FlowState, type TaxMode } from "./logic";

type TaxFields = Pick<FlowState, "taxMode" | "taxName" | "taxRate" | "discount" | "notes" | "paymentInstructions">;

interface Props extends TaxFields {
  termsDays: number;
  clientTerms: number;
  issueDate: string;
  error: string | null;
  onChange: (patch: Partial<TaxFields>) => void;
  onTerms: (days: number) => void;
}

const TAX_MODES: { value: TaxMode; label: string }[] = [
  { value: "default", label: "My default taxes (set in your business profile)" },
  { value: "none", label: "No tax on this invoice" },
  { value: "custom", label: "One tax I choose here" },
];

export function StepTax({ taxMode, taxName, taxRate, discount, notes, paymentInstructions, termsDays, clientTerms, issueDate, error, onChange, onTerms }: Props) {
  const nameErr = error?.startsWith("Tax needs") ? error : undefined;
  const rateErr = error?.startsWith("Tax must") ? error : undefined;
  const discErr = error?.startsWith("Discount") ? error : undefined;
  const textErr = error?.startsWith("Notes") || error?.startsWith("Payment note") ? error : undefined;
  const shown = nameErr ?? rateErr ?? discErr ?? textErr;
  return (
    <section aria-labelledby="ic-3" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2"><h2 id="ic-3" className="t-h2">Tax and discount</h2></div>
      <div className="grid gap-4 @2xl:grid-cols-3">
        <Field label="Tax" htmlFor="ic-taxmode" hint={taxMode === "default" ? "The server adds them when it creates the invoice." : undefined}>
          <SelectField id="ic-taxmode" value={taxMode} onValueChange={(v) => onChange({ taxMode: v as TaxMode })} options={TAX_MODES} />
        </Field>
        <Field label="Discount" htmlFor="ic-disc" hint="A percentage taken off before tax." error={discErr}>
          <InputAffix suffix="%"><Input id="ic-disc" inputMode="decimal" value={discount} onChange={(e) => onChange({ discount: e.target.value })} aria-invalid={Boolean(discErr)} /></InputAffix>
        </Field>
        <Field label="Payment terms" htmlFor="ic-due" hint={`Due ${fmtDate(dueDateFor(issueDate, termsDays))}`}>
          <SelectField
            id="ic-due" value={String(termsDays)} onValueChange={(v) => onTerms(Number(v))}
            options={termsOptions(clientTerms).map((d) => ({ value: String(d), label: `${termsLabel(d)}${d === clientTerms ? " · client’s terms" : ""} · due ${fmtDate(dueDateFor(issueDate, d))}` }))}
          />
        </Field>
      </div>
      {taxMode === "custom" && (
        <div className="grid gap-4 @2xl:grid-cols-3">
          <Field label="Tax name" htmlFor="ic-taxname" error={nameErr}>
            <Input id="ic-taxname" value={taxName} placeholder="VAT" onChange={(e) => onChange({ taxName: e.target.value })} aria-invalid={Boolean(nameErr)} />
          </Field>
          <Field label="Tax rate" htmlFor="ic-tax" error={rateErr}>
            <InputAffix suffix="%"><Input id="ic-tax" inputMode="decimal" value={taxRate} onChange={(e) => onChange({ taxRate: e.target.value })} aria-invalid={Boolean(rateErr)} /></InputAffix>
          </Field>
        </div>
      )}
      <Field label="Payment note" htmlFor="ic-instr" hint={`How your client should pay, e.g. an account to use. Up to ${INSTRUCTIONS_MAX} characters.`}>
        <Textarea id="ic-instr" value={paymentInstructions} maxLength={INSTRUCTIONS_MAX + 100} onChange={(e) => onChange({ paymentInstructions: e.target.value })} />
      </Field>
      <Field label="Notes" htmlFor="ic-notes" hint="Shown to your client on the invoice. Optional.">
        <Textarea id="ic-notes" value={notes} maxLength={NOTES_MAX + 100} onChange={(e) => onChange({ notes: e.target.value })} />
      </Field>
      {error && !shown && <p role="alert" className="text-sm text-error-ink">{error}</p>}
      {textErr && <p role="alert" className="text-sm text-error-ink">{textErr}</p>}
      <Notice>Any tax withheld by your client is recorded when the payment arrives, not on the invoice. Tax figures are informational, not legal or tax advice.</Notice>
    </section>
  );
}
