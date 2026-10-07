"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Field, Label } from "@/components/ui/label";
import { Section } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { CURRENCIES, type BusinessProfile } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { businessFormSchema, fromFormValues, nextNumberPreview, termsOptions, toFormValues, type BusinessFormValues } from "./business-schema";

const MAX_LOGO_BYTES = 500 * 1024;

export function BusinessForm({ business, invoiceNumbers }: { business: BusinessProfile; invoiceNumbers: string[] }) {
  const updateBusiness = useAppStore((s) => s.updateBusiness);
  const schema = useMemo(() => businessFormSchema(invoiceNumbers), [invoiceNumbers]);
  const defaults = useMemo(() => toFormValues(business), [business]);
  const [logoError, setLogoError] = useState("");

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isDirty, isSubmitting } } = useForm<BusinessFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const logoName = watch("logoName");
  const prefix = watch("invoicePrefix");
  const next = watch("nextInvoiceNumber");
  const preview = nextNumberPreview(prefix ?? "", next ?? "");

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const save = handleSubmit((values) => {
    updateBusiness(fromFormValues(values));
    reset(values);
    toast.success("Business profile saved");
  });

  const a11y = (name: keyof BusinessFormValues, hint = false) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `bp-${name}-error` : hint ? `bp-${name}-hint` : undefined,
  });
  const msg = (name: keyof BusinessFormValues) => errors[name]?.message;

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const okType = ["image/png", "image/svg+xml"].includes(file.type) || /\.(png|svg)$/i.test(file.name);
    if (!okType) return setLogoError("Use a PNG or SVG file.");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("That file is over 500 KB. Choose a smaller one.");
    setLogoError("");
    setValue("logoName", file.name, { shouldDirty: true });
  };

  return (
    <Section title="Business profile" id="st-b" className="max-w-[44rem]" action={isDirty ? <Tag tone="warning" role="status">Unsaved changes</Tag> : undefined}>
      <p className="text-sm text-muted-foreground">Shown at the top of every invoice and on your clients’ share links.</p>
      <form onSubmit={save} noValidate aria-label="Business profile" className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
          <Field label="Business name" htmlFor="bp-businessName" error={msg("businessName")} className="@xl:col-span-2">
            <Input id="bp-businessName" autoComplete="organization" {...a11y("businessName")} {...register("businessName")} />
          </Field>
          <Field label="Your name" htmlFor="bp-ownerName" error={msg("ownerName")}>
            <Input id="bp-ownerName" autoComplete="name" {...a11y("ownerName")} {...register("ownerName")} />
          </Field>
          <Field label="Billing email" htmlFor="bp-email" error={msg("email")}>
            <Input id="bp-email" type="email" autoComplete="email" {...a11y("email")} {...register("email")} />
          </Field>
          <Field label="Phone / WhatsApp" htmlFor="bp-phone" error={msg("phone")}>
            <Input id="bp-phone" type="tel" autoComplete="tel" className="num" {...a11y("phone")} {...register("phone")} />
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
          <Field label="Invoice number prefix" htmlFor="bp-invoicePrefix" error={msg("invoicePrefix")}>
            <Input id="bp-invoicePrefix" className="num" autoComplete="off" {...a11y("invoicePrefix")} {...register("invoicePrefix")} />
          </Field>
          <Field label="Next number" htmlFor="bp-nextInvoiceNumber" error={msg("nextInvoiceNumber")}
            hint={<>Numbers are never reused, even after a void.{preview && <> Your next invoice will be <b className="num font-semibold text-foreground">{preview}</b>.</>}</>}>
            <Input id="bp-nextInvoiceNumber" inputMode="numeric" className="num" autoComplete="off" {...a11y("nextInvoiceNumber", true)} {...register("nextInvoiceNumber")} />
          </Field>
          <Field label="Invoice footer note" htmlFor="bp-footerNote" optional error={msg("footerNote")} className="@xl:col-span-2">
            <Input id="bp-footerNote" {...a11y("footerNote")} {...register("footerNote")} />
          </Field>
          <div className="flex flex-col gap-2 @xl:col-span-2">
            <span id="bp-logo-label" className="text-sm font-semibold">Logo <span className="font-normal text-muted-foreground">(optional)</span></span>
            <div className="flex flex-wrap items-center gap-3">
              <Label className={cn(buttonVariants({ variant: "outline" }), "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring")}>
                <Upload aria-hidden="true" />{logoName ? "Replace logo" : "Upload logo"}
                <Input type="file" accept="image/png,image/svg+xml,.png,.svg" className="sr-only min-h-0" aria-labelledby="bp-logo-label" aria-describedby="bp-logo-hint" onChange={onLogo} />
              </Label>
              {logoName && (
                <span className="inline-flex min-w-0 items-center gap-1 text-sm">
                  <span className="num truncate font-semibold">{logoName}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove logo ${logoName}`} onClick={() => { setValue("logoName", undefined, { shouldDirty: true }); setLogoError(""); }}><X aria-hidden="true" /></Button>
                </span>
              )}
            </div>
            <span id="bp-logo-hint" className="text-xs text-muted-foreground">PNG or SVG, under 500 KB.</span>
            {logoError && <p role="alert" className="text-xs text-error-ink">{logoError}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
          <Button variant="ghost" disabled={!isDirty} onClick={() => { reset(defaults); setLogoError(""); }}>Discard</Button>
          <span role="status" className="text-xs text-muted-foreground">{isDirty ? "You have unsaved changes." : ""}</span>
        </div>
      </form>
    </Section>
  );
}
