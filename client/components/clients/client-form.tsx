"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, ChoiceRow } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/label";
import { Input, InputAffix } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { METHOD_KINDS } from "@/lib/payment-methods";
import { useAppStore } from "@/lib/store";
import { CURRENCIES, type Client, type PaymentMethodKind } from "@/lib/types";
import { DiscardDialog, describedBy, useUnsavedChanges } from "./form-parts";
import { clientSchema, clientToForm, COUNTRIES, emptyClientForm, formToClient, TERMS_PRESETS, termsLabel, type ClientFormValues } from "./schema";

const FALLBACK_KINDS: PaymentMethodKind[] = ["payoneer", "esfca", "pkrbank", "raast"];
const grid = "grid gap-5 @2xl:grid-cols-2";
const wide = "@2xl:col-span-2";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const business = useAppStore((s) => s.business);
  const methods = useAppStore((s) => s.methods);
  const online = useAppStore((s) => s.online);
  const addClient = useAppStore((s) => s.addClient);
  const updateClient = useAppStore((s) => s.updateClient);
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? clientToForm(client) : emptyClientForm(business.defaultCurrency, business.defaultTermsDays),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting, submitCount } } = form;
  useUnsavedChanges(isDirty && !saved);

  const back = client ? `/clients/${client.id}` : "/clients";
  const kinds = [...new Set<PaymentMethodKind>([...(methods.length ? methods.map((m) => m.kind) : FALLBACK_KINDS), ...(client?.prefersMethods ?? [])])];
  const terms = [...new Set([...TERMS_PRESETS, Number(form.getValues("termsDays"))])].sort((a, b) => a - b);
  const countries = COUNTRIES.some((c) => c.value === form.getValues("country")) || !form.getValues("country") ? COUNTRIES : [...COUNTRIES, { value: form.getValues("country"), label: form.getValues("country") }];
  const errorCount = Object.keys(errors).length;

  const onSubmit = (values: ClientFormValues) => {
    const data = formToClient(values);
    setSaved(true);
    if (client) {
      updateClient(client.id, data);
      toast.success(`${data.name} saved`);
      router.push(back);
    } else {
      const created = addClient(data);
      toast.success(`${created.name} added`);
      router.push(`/clients/${created.id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-10">
      {submitCount > 0 && errorCount > 0 && (
        <Notice tone="error" role="alert">{errorCount === 1 ? "One field needs attention before you can save." : `${errorCount} fields need attention before you can save.`}</Notice>
      )}
      {!online && <Notice tone="warn">You’re offline. This client is saved on this device and syncs when you reconnect.</Notice>}

      <Section title="Contact" level={3} id="cf-contact">
        <div className={grid}>
          <Field label="Client or company" htmlFor="cf-name" error={errors.name?.message}>
            <Input id="cf-name" autoComplete="organization" placeholder="Harbor Labs" aria-invalid={!!errors.name} aria-describedby={describedBy("cf-name", errors.name?.message, false)} {...register("name")} />
          </Field>
          <Field label="Contact name" htmlFor="cf-contact-name" optional>
            <Input id="cf-contact-name" autoComplete="name" placeholder="Jordan Reyes" {...register("contactName")} />
          </Field>
          <Field className={wide} label="Email" htmlFor="cf-email" hint="Invoices and reminders are sent here." error={errors.email?.message}>
            <Input id="cf-email" type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" aria-invalid={!!errors.email} aria-describedby={describedBy("cf-email", errors.email?.message, true)} {...register("email")} />
          </Field>
          <Field className={wide} label="WhatsApp number" htmlFor="cf-wa" optional error={errors.whatsapp?.message} hint="Used to share invoices and reminders by WhatsApp message. Paylancr never messages your client on its own.">
            <InputAffix prefix="+">
              <Input id="cf-wa" type="tel" inputMode="tel" autoComplete="tel" className="num text-start" placeholder="1 512 555 0142" aria-invalid={!!errors.whatsapp} aria-describedby={describedBy("cf-wa", errors.whatsapp?.message, true)} {...register("whatsapp")} />
            </InputAffix>
          </Field>
          <Field label="Country" htmlFor="cf-country">
            <FormSelect id="cf-country" control={control} name="country" placeholder="Choose a country" options={countries.map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
          <Field label="City" htmlFor="cf-city" optional>
            <Input id="cf-city" autoComplete="address-level2" placeholder="Austin" {...register("city")} />
          </Field>
        </div>
      </Section>

      <Section title="Billing" level={3} id="cf-billing">
        <div className={grid}>
          <Field label="Bills in" htmlFor="cf-cur">
            <FormSelect id="cf-cur" control={control} name="currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Payment terms" htmlFor="cf-terms" error={errors.termsDays?.message}>
            <FormSelect id="cf-terms" control={control} name="termsDays" options={terms.map((d) => ({ value: String(d), label: termsLabel(d) }))} />
          </Field>
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-sm font-semibold">Payment methods shown to this client</legend>
          <Controller
            control={control}
            name="prefersMethods"
            render={({ field }) => (
              <div className="border-t border-border">
                {kinds.map((k) => {
                  const on = field.value.includes(k);
                  const info = METHOD_KINDS[k];
                  return (
                    <ChoiceRow key={k}>
                      <Checkbox checked={on} onCheckedChange={(v) => field.onChange(v === true ? [...field.value, k] : field.value.filter((x) => x !== k))} className="mt-0.5" />
                      <span><span className="block font-medium">{info.label}</span><span className="t-caption">{info.audience}</span></span>
                    </ChoiceRow>
                  );
                })}
              </div>
            )}
          />
          <p className="mt-2 text-xs text-muted-foreground">New invoices for this client start with these. You can change them per invoice.</p>
        </fieldset>
      </Section>

      <Section title="Notes" level={3} id="cf-notes-h">
        <Field label={<span className="sr-only">Notes</span>} htmlFor="cf-notes">
          <Textarea id="cf-notes" placeholder="Anything worth remembering. Only you see this." {...register("notes")} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={isSubmitting}>{client ? "Save changes" : "Add client"}</Button>
        <Button variant="ghost" onClick={() => (isDirty && !saved ? setDiscard(true) : router.push(back))}>Cancel</Button>
      </div>
      <DiscardDialog open={discard} onOpenChange={setDiscard} onDiscard={() => router.push(back)} />
    </form>
  );
}
