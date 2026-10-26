"use client";

import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { describedBy } from "@/components/clients/form-parts";
import { Field } from "@/components/ui/label";
import { Input, InputAffix } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Currency } from "@/lib/types";
import type { ProjectFormValues } from "./schema";

interface Props {
  type: ProjectFormValues["billingType"];
  currency: Currency;
  control: Control<ProjectFormValues>;
  register: UseFormRegister<ProjectFormValues>;
  errors: FieldErrors<ProjectFormValues>;
}

const INTERVALS = [{ value: "monthly", label: "Every month" }, { value: "quarterly", label: "Every quarter" }];

/** The inputs that apply to the chosen billing type, plus the milestones switch. */
export function BillingFields({ type, currency, control, register, errors }: Props) {
  const grid = "grid gap-5 @2xl:grid-cols-2";
  return (
    <div className="flex flex-col gap-5">
      {type === "fixed" && (
        <div className={grid}>
          <Field label="Price" htmlFor="pf-price" error={errors.budget?.message}>
            <InputAffix prefix={currency}><Input id="pf-price" inputMode="decimal" className="num" placeholder="120,000" aria-invalid={!!errors.budget} aria-describedby={describedBy("pf-price", errors.budget?.message, false)} {...register("budget")} /></InputAffix>
          </Field>
        </div>
      )}
      {type === "hourly" && (
        <div className={grid}>
          <Field label="Hourly rate" htmlFor="pf-rate" optional error={errors.hourlyRate?.message} hint="Leave blank to use the rate from your profile.">
            <InputAffix prefix={currency} suffix="/ h"><Input id="pf-rate" inputMode="decimal" className="num" placeholder="45.00" aria-invalid={!!errors.hourlyRate} aria-describedby={describedBy("pf-rate", errors.hourlyRate?.message, true)} {...register("hourlyRate")} /></InputAffix>
          </Field>
        </div>
      )}
      {type === "retainer" && (
        <div className={grid}>
          <Field label="Amount per period" htmlFor="pf-ret" error={errors.retainerAmount?.message}>
            <InputAffix prefix={currency}><Input id="pf-ret" inputMode="decimal" className="num" placeholder="1,200.00" aria-invalid={!!errors.retainerAmount} aria-describedby={describedBy("pf-ret", errors.retainerAmount?.message, false)} {...register("retainerAmount")} /></InputAffix>
          </Field>
          <Field label="Billed" htmlFor="pf-interval" error={errors.retainerInterval?.message}>
            <FormSelect id="pf-interval" control={control} name="retainerInterval" placeholder="Choose how often" options={INTERVALS} aria-invalid={!!errors.retainerInterval} aria-describedby={describedBy("pf-interval", errors.retainerInterval?.message, false)} />
          </Field>
          <Field label="Starts" htmlFor="pf-rstart" optional error={errors.retainerStartDate?.message} hint="Defaults to today.">
            <Input id="pf-rstart" type="date" className="num" aria-describedby={describedBy("pf-rstart", errors.retainerStartDate?.message, true)} {...register("retainerStartDate")} />
          </Field>
          <Field label="Ends" htmlFor="pf-rend" optional error={errors.retainerEndDate?.message}>
            <Input id="pf-rend" type="date" className="num" aria-invalid={!!errors.retainerEndDate} aria-describedby={describedBy("pf-rend", errors.retainerEndDate?.message, false)} {...register("retainerEndDate")} />
          </Field>
          <p className="text-xs text-muted-foreground @2xl:col-span-2">Each period appears on the project as invoiced or not yet invoiced. Paylancr never charges your client automatically.</p>
        </div>
      )}
      {type === "milestone" ? (
        <p className="text-sm text-muted-foreground">Milestones are always on for this billing type. Add them on the project page once it exists.</p>
      ) : (
        <Controller
          control={control}
          name="milestonesEnabled"
          render={({ field }) => <Switch label="Break this project into milestones" checked={field.value} onCheckedChange={field.onChange} />}
        />
      )}
    </div>
  );
}
