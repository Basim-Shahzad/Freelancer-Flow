"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { describedBy } from "../form-bits";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { COUNTRIES, businessSchema, type BusinessValues } from "../schemas";
import { FORM_GRID, StepActions } from "./step-actions";

export function BusinessStep({ value, onNext }: { value: BusinessValues; onNext: (v: BusinessValues) => void }) {
  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<BusinessValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: value,
    mode: "onTouched",
  });
  const country = useWatch({ control, name: "country" });
  useEffect(() => { if (country !== "PK") setValue("taxId", ""); }, [country, setValue]);
  const e = (k: keyof BusinessValues) => ({ "aria-invalid": !!errors[k], "aria-describedby": describedBy(`ob-${k}`, errors[k]?.message, k === "taxId") });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate aria-label="Business profile" className="flex flex-col gap-6">
      <div className={FORM_GRID}>
        <Field label="Business or studio name" htmlFor="ob-businessName" error={errors.businessName?.message}>
          <Input id="ob-businessName" autoComplete="organization" {...e("businessName")} {...register("businessName")} />
        </Field>
        <Field label="Your name" htmlFor="ob-ownerName" error={errors.ownerName?.message}>
          <Input id="ob-ownerName" autoComplete="name" {...e("ownerName")} {...register("ownerName")} />
        </Field>
        <Field label="Country" htmlFor="ob-country">
          <FormSelect id="ob-country" autoComplete="country" control={control} name="country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.label }))} />
        </Field>
        <Field label="City" htmlFor="ob-city" error={errors.city?.message}>
          <Input id="ob-city" autoComplete="address-level2" {...e("city")} {...register("city")} />
        </Field>
        <Field label="Address" htmlFor="ob-address" optional className="col-span-full" error={errors.address?.message}>
          <Textarea id="ob-address" autoComplete="street-address" placeholder="Shown on invoices" {...e("address")} {...register("address")} />
        </Field>
        {country === "PK" && (
          <Field label="NTN" htmlFor="ob-taxId" optional error={errors.taxId?.message} hint="Pakistan tax number. Printed on invoices.">
            <Input id="ob-taxId" className="num" placeholder="1234567-8" inputMode="numeric" {...e("taxId")} {...register("taxId")} />
          </Field>
        )}
      </div>
      <StepActions primary="Continue" />
    </form>
  );
}
