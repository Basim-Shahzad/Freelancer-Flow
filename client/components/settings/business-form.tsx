"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Section } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { useSaveBusiness } from "@/lib/hooks/profile";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useIsOnline } from "@/lib/hooks/use-online";
import { CURRENCIES, type BusinessProfile } from "@/lib/types";
import { businessFormSchema, fromFormValues, formatSampleNumber, termsOptions, toFormValues, type BusinessFormValues } from "./business-schema";
import { useFocusFirstError } from "@/lib/hooks/use-focus-first-error";

/** API field -> form field, for 422 responses. */
const API_FIELD_ALIASES = { businessAddress: "address", taxRegistrationNumber: "taxId", currency: "defaultCurrency", defaultPaymentTermsDays: "defaultTermsDays" };

export function BusinessForm({ business }: { business: BusinessProfile }) {
  const { save: saveBusiness } = useSaveBusiness();
  const toast = useApiToast();
  const online = useIsOnline();
  const schema = useMemo(() => businessFormSchema(), []);
  const defaults = useMemo(() => toFormValues(business), [business]);

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  useFocusFirstError(form);
  const { register, control, handleSubmit, reset, watch, formState: { errors, isDirty, isSubmitting } } = form;

  const preview = formatSampleNumber(watch("invoiceNumberFormat") ?? "");

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const save = handleSubmit(async (values) => {
    if (!online) return toast.error(null, "You’re offline. Reconnect to save your business profile.");
    try {
      await saveBusiness(fromFormValues(values, business));
    } catch (e) {
      if (!applyApiFieldErrors(form, e, API_FIELD_ALIASES)) toast.error(e, "Couldn’t save your business profile.");
      return;
    }
    reset(values);
    toast.success("Business profile saved");
  });

  const a11y = (name: keyof BusinessFormValues, hint = false) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `bp-${name}-error` : hint ? `bp-${name}-hint` : undefined,
  });
  const msg = (name: keyof BusinessFormValues) => errors[name]?.message;

  return (
    <Section title="Business profile" id="st-b" className="max-w-[44rem]" action={isDirty ? <Tag tone="warning" role="status">Unsaved changes</Tag> : undefined}>
      <p className="text-sm text-muted-foreground">Shown at the top of every invoice and on your clients’ share links.</p>
      <form onSubmit={save} noValidate aria-label="Business profile" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
          <Field label="Business name" htmlFor="bp-businessName" error={msg("businessName")} className="@xl:col-span-2">
            <Input id="bp-businessName" autoComplete="organization" {...a11y("businessName")} {...register("businessName")} />
          </Field>
          <Field label="Your name" htmlFor="bp-ownerName" error={msg("ownerName")} hint="From your account.">
            <Input id="bp-ownerName" autoComplete="name" readOnly {...a11y("ownerName", true)} {...register("ownerName")} />
          </Field>
          <Field label="Billing email" htmlFor="bp-email" error={msg("email")} hint="Your login email.">
            <Input id="bp-email" type="email" autoComplete="email" readOnly {...a11y("email", true)} {...register("email")} />
          </Field>
          <Field label="NTN" htmlFor="bp-taxId" optional error={msg("taxId")} hint="Your tax ID, if you want it printed on invoices.">
            <Input id="bp-taxId" className="num" {...a11y("taxId", true)} {...register("taxId")} />
          </Field>
          <Field label="Address" htmlFor="bp-address" error={msg("address")} className="@xl:col-span-2">
            <Textarea id="bp-address" rows={3} autoComplete="street-address" {...a11y("address")} {...register("address")} />
          </Field>
          <Field label="Default currency" htmlFor="bp-defaultCurrency" error={msg("defaultCurrency")}>
            <FormSelect id="bp-defaultCurrency" {...a11y("defaultCurrency")} control={control} name="defaultCurrency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Default payment terms" htmlFor="bp-defaultTermsDays" error={msg("defaultTermsDays")}>
            <FormSelect id="bp-defaultTermsDays" {...a11y("defaultTermsDays")} control={control} name="defaultTermsDays" options={termsOptions(business.defaultTermsDays).map((t) => ({ value: String(t.days), label: t.label }))} />
          </Field>
          <Field label="Your hourly rate" htmlFor="bp-hourlyRate" optional error={msg("hourlyRate")} hint="Used on Projects to show whether fixed-fee work pays above or below your rate. In your default currency.">
            <Input id="bp-hourlyRate" inputMode="decimal" className="num" autoComplete="off" {...a11y("hourlyRate", true)} {...register("hourlyRate")} />
          </Field>
          <Field label="Invoice number format" htmlFor="bp-invoiceNumberFormat" error={msg("invoiceNumberFormat")}
            hint={<>The server numbers your invoices and never reuses a number. Use {"{seq}"} (or {"{seq:04d}"} to pad) and optionally {"{year}"}.{preview && <> Example: <b className="num font-semibold text-foreground">{preview}</b>.</>}</>}>
            <Input id="bp-invoiceNumberFormat" className="num" autoComplete="off" {...a11y("invoiceNumberFormat", true)} {...register("invoiceNumberFormat")} />
          </Field>
          <Field label="Payment instructions" htmlFor="bp-paymentInstructions" optional error={msg("paymentInstructions")} className="@xl:col-span-2"
            hint="Copied onto new invoices by default.">
            <Textarea id="bp-paymentInstructions" rows={3} {...a11y("paymentInstructions", true)} {...register("paymentInstructions")} />
          </Field>
          {business.logoUrl && (
            <div className="flex flex-col gap-2 @xl:col-span-2">
              <span className="text-sm font-semibold">Logo</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={business.logoUrl} alt="Your logo" className="max-h-16 w-auto self-start object-contain" />
            </div>
          )}
        </div>
        {errors.root?.message && <p role="alert" className="text-sm text-error-ink">{errors.root.message}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
          <Button variant="ghost" disabled={!isDirty} onClick={() => { reset(defaults); }}>Discard</Button>
          <span role="status" className="text-xs text-muted-foreground">{isDirty ? "You have unsaved changes." : ""}</span>
        </div>
      </form>
    </Section>
  );
}
