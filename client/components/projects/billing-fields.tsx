"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field } from "@/components/ui/label";
import { Input, InputAffix } from "@/components/ui/input";
import type { Currency } from "@/lib/types";
import { describedBy } from "@/components/clients/form-parts";
import type { ProjectFormValues } from "./schema";

interface Props { type: ProjectFormValues["billingType"]; currency: Currency; register: UseFormRegister<ProjectFormValues>; errors: FieldErrors<ProjectFormValues> }

/** The amount inputs that apply to the chosen billing type. */
export function BillingFields({ type, currency, register, errors }: Props) {
  const grid = "grid gap-5 @2xl:grid-cols-2";
  if (type === "fixed") {
    return (
      <div className={grid}>
        <Field label="Price" htmlFor="pf-price" error={errors.fixedAmount?.message}>
          <InputAffix prefix={currency}><Input id="pf-price" inputMode="decimal" className="num" placeholder="120,000" aria-invalid={!!errors.fixedAmount} aria-describedby={describedBy("pf-price", errors.fixedAmount?.message, false)} {...register("fixedAmount")} /></InputAffix>
        </Field>
      </div>
    );
  }
  if (type === "hourly") {
    return (
      <div className={grid}>
        <Field label="Hourly rate" htmlFor="pf-rate" error={errors.hourlyRate?.message}>
          <InputAffix prefix={currency} suffix="/ h"><Input id="pf-rate" inputMode="decimal" className="num" placeholder="45.00" aria-invalid={!!errors.hourlyRate} aria-describedby={describedBy("pf-rate", errors.hourlyRate?.message, false)} {...register("hourlyRate")} /></InputAffix>
        </Field>
      </div>
    );
  }
  if (type === "retainer") {
    return (
      <div className={grid}>
        <Field label="Amount per month" htmlFor="pf-ret" error={errors.retainerAmount?.message}>
          <InputAffix prefix={currency}><Input id="pf-ret" inputMode="decimal" className="num" placeholder="1,200.00" aria-invalid={!!errors.retainerAmount} aria-describedby={describedBy("pf-ret", errors.retainerAmount?.message, false)} {...register("retainerAmount")} /></InputAffix>
        </Field>
        <Field label="Included hours per month" htmlFor="pf-hours" optional error={errors.retainerHours?.message}>
          <Input id="pf-hours" inputMode="decimal" className="num" placeholder="12" aria-invalid={!!errors.retainerHours} aria-describedby={describedBy("pf-hours", errors.retainerHours?.message, false)} {...register("retainerHours")} />
        </Field>
        <p className="text-xs text-muted-foreground @2xl:col-span-2">Each month appears in the project with a Create invoice button. Paylancr never charges your client automatically.</p>
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">The budget is the total of your milestones below. Each approved milestone gets its own invoice.</p>;
}
