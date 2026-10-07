"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Field } from "@/components/ui/label";
import { Input, InputAffix } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/types";
import { describedBy } from "../form-bits";
import { clientSchema, type ClientValues } from "../schemas";
import { FORM_GRID, StepActions } from "./step-actions";

export function ClientStep({ value, onNext, onBack, onSkip }: {
  value: ClientValues; onNext: (v: ClientValues) => void; onBack: (v: ClientValues) => void; onSkip: () => void;
}) {
  const { register, control, handleSubmit, getValues, formState: { errors } } = useForm<ClientValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: value,
    mode: "onTouched",
  });
  const e = (k: keyof ClientValues, hint?: boolean) => ({ "aria-invalid": !!errors[k], "aria-describedby": describedBy(`ob-c-${k}`, errors[k]?.message, hint) });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate aria-label="First client" className="flex flex-col gap-6">
      <div className={FORM_GRID}>
        <Field label="Contact name" htmlFor="ob-c-contactName" error={errors.contactName?.message}>
          <Input id="ob-c-contactName" autoComplete="off" {...e("contactName")} {...register("contactName")} />
        </Field>
        <Field label="Company" htmlFor="ob-c-company" optional>
          <Input id="ob-c-company" autoComplete="off" {...register("company")} />
        </Field>
        <Field label="Email" htmlFor="ob-c-email" className="col-span-full" error={errors.email?.message}>
          <Input id="ob-c-email" type="email" autoComplete="off" {...e("email")} {...register("email")} />
        </Field>
        <Field
          label="WhatsApp number" htmlFor="ob-c-whatsapp" optional className="col-span-full" error={errors.whatsapp?.message}
          hint="Include the country code. Paylancr opens a WhatsApp chat with a ready-to-send message; it never messages your client on its own."
        >
          <InputAffix prefix="+" className="aria-[invalid=true]:border-error">
            <Input id="ob-c-whatsapp" type="tel" inputMode="tel" autoComplete="off" className="num text-start" placeholder="92 321 4567890" {...e("whatsapp", true)} {...register("whatsapp")} />
          </InputAffix>
        </Field>
        <Field label="City" htmlFor="ob-c-city" optional>
          <Input id="ob-c-city" autoComplete="off" {...register("city")} />
        </Field>
        <Field label="Bills in" htmlFor="ob-c-currency">
          <FormSelect id="ob-c-currency" control={control} name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Field>
      </div>
      <StepActions onBack={() => onBack(getValues())} onSkip={onSkip} primary="Finish setup" />
    </form>
  );
}
