"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/select";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { applyApiFieldErrors } from "@/lib/api/field-errors";
import { clientToCreate, clientToUpdate } from "@/lib/api/mappers/clients";
import { useCreateClient, useUpdateClient } from "@/lib/hooks/clients";
import { useApiToast } from "@/lib/hooks/use-api-toast";
import { useBusiness } from "@/lib/hooks/profile";
import { getApiErrorStatus } from "@/lib/services/api.service";
import { useAppStore } from "@/lib/store";
import { CURRENCIES, type Client } from "@/lib/types";
import { DiscardDialog, describedBy, useUnsavedChanges } from "./form-parts";
import { CLIENT_FIELD_ALIASES, clientSchema, clientToForm, emptyClientForm, formToClient, TERMS_PRESETS, termsLabel, type ClientFormValues } from "./schema";

const grid = "grid gap-5 @2xl:grid-cols-2";
const wide = "@2xl:col-span-2";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const business = useBusiness();
  const toast = useApiToast();
  const online = useAppStore((s) => s.online);
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? "");
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
  const terms = [...new Set([...TERMS_PRESETS, Number(form.getValues("termsDays"))])].sort((a, b) => a - b);
  const errorCount = Object.keys(errors).length;
  const rootError = errors.root?.message;

  const onSubmit = async (values: ClientFormValues) => {
    if (!online) return toast.error(null, "You’re offline. Reconnect to save this client.");
    const data = formToClient(values);
    try {
      if (client) {
        const changes = clientToUpdate(data, formToClient(clientToForm(client)));
        if (Object.keys(changes).length > 0) await update.mutateAsync(changes);
        setSaved(true);
        toast.success(`${data.companyName || data.name} saved`);
        router.push(back);
      } else {
        const created = await create.mutateAsync(clientToCreate(data));
        setSaved(true);
        toast.success(`${data.companyName || data.name} added`);
        router.push(`/clients/${created.id}`);
      }
    } catch (e) {
      const status = getApiErrorStatus(e);
      if (status === 409) {
        form.setError("email", { type: "server", message: "A client with this email already exists." }, { shouldFocus: true });
      } else if (status === 404) {
        toast.error(e, "This client no longer exists.");
      } else if (!applyApiFieldErrors(form, e, CLIENT_FIELD_ALIASES)) {
        toast.error(e, "Couldn’t save this client.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-10">
      {submitCount > 0 && errorCount > 0 && (
        <Notice tone="error" role="alert">{rootError ?? (errorCount === 1 ? "One field needs attention before you can save." : `${errorCount} fields need attention before you can save.`)}</Notice>
      )}
      {!online && <Notice tone="warn">You’re offline. Reconnect to save this client.</Notice>}

      <Section title="Contact" level={3} id="cf-contact">
        <div className={grid}>
          <Field label="Name" htmlFor="cf-name" error={errors.name?.message}>
            <Input id="cf-name" autoComplete="name" placeholder="Jordan Reyes" aria-invalid={!!errors.name} aria-describedby={describedBy("cf-name", errors.name?.message, false)} {...register("name")} />
          </Field>
          <Field label="Company" htmlFor="cf-company" optional error={errors.companyName?.message}>
            <Input id="cf-company" autoComplete="organization" placeholder="Harbor Labs" {...register("companyName")} />
          </Field>
          <Field className={wide} label="Email" htmlFor="cf-email" hint="Invoices and reminders are sent here." error={errors.email?.message}>
            <Input id="cf-email" type="email" inputMode="email" autoComplete="email" placeholder="name@company.com" aria-invalid={!!errors.email} aria-describedby={describedBy("cf-email", errors.email?.message, true)} {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="cf-phone" optional error={errors.phone?.message}>
            <Input id="cf-phone" type="tel" inputMode="tel" autoComplete="tel" className="num text-start" {...register("phone")} />
          </Field>
          <Field label="WhatsApp number" htmlFor="cf-wa" optional error={errors.whatsapp?.message} hint="Used to share invoices and reminders by WhatsApp message. Paylancr never messages your client on its own. A local number like 0321 4567890 is saved as +92 321 4567890.">
            <Input id="cf-wa" type="tel" inputMode="tel" autoComplete="tel" className="num text-start" placeholder="+1 512 555 0142" aria-invalid={!!errors.whatsapp} aria-describedby={describedBy("cf-wa", errors.whatsapp?.message, true)} {...register("whatsapp")} />
          </Field>
          <Field className={wide} label="Address" htmlFor="cf-address" optional error={errors.address?.message}>
            <Textarea id="cf-address" autoComplete="street-address" placeholder="Street, city, country" {...register("address")} />
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
          <Field className={wide} label="Tax ID" htmlFor="cf-tax" optional error={errors.taxId?.message}>
            <Input id="cf-tax" className="num text-start" {...register("taxId")} />
          </Field>
        </div>
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
