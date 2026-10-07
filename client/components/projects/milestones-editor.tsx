"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { LedgerHead } from "@/components/ui/ledger";
import { Section } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import { formatMoney, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils";
import { describedBy } from "@/components/clients/form-parts";
import { emptyRow, milestoneSum, milestoneTarget, type ProjectFormValues } from "./schema";

const COLS = "minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) 7.5rem";
const TEMPLATES: Record<string, { label: string; rows: [string, number][] }> = {
  web: { label: "Web design", rows: [["Discovery", 20], ["Design", 30], ["Build", 35], ["Launch", 15]] },
  dev: { label: "Development", rows: [["Planning", 15], ["Core features", 40], ["Testing", 25], ["Release", 20]] },
  content: { label: "Content", rows: [["Outline", 20], ["First draft", 40], ["Revisions", 25], ["Final delivery", 15]] },
  consulting: { label: "Consulting", rows: [["Audit", 25], ["Recommendations", 30], ["Implementation support", 30], ["Handover", 15]] },
};

interface Props {
  control: Control<ProjectFormValues>;
  register: UseFormRegister<ProjectFormValues>;
  errors: FieldErrors<ProjectFormValues>;
  /** Milestone ids that are approved/awaiting/invoiced and so can't be removed. */
  lockedIds: Set<string>;
}

export function MilestonesEditor({ control, register, errors, lockedIds }: Props) {
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "milestones" });
  const rows = useWatch({ control, name: "milestones" });
  const type = useWatch({ control, name: "billingType" });
  const currency = useWatch({ control, name: "currency" });
  const fixedAmount = useWatch({ control, name: "fixedAmount" });
  const [tpl, setTpl] = useState("");

  const required = type === "milestone";
  const enabled = required || fields.length > 0;
  const total = milestoneSum(rows);
  const target = milestoneTarget({ billingType: type, fixedAmount });
  const diff = target !== null ? target - total : 0;
  const matches = target !== null && target > 0 && diff === 0;
  const sumText = target !== null && target > 0
    ? (diff === 0 ? `Adds up to ${formatMoney(total, currency)}` : `${formatMoney(Math.abs(diff), currency)} ${diff > 0 ? "not yet allocated" : "over the price"}`)
    : `Total ${formatMoney(total, currency)}`;
  const listError = errors.milestones?.root?.message ?? (errors.milestones && !Array.isArray(errors.milestones) ? errors.milestones.message : undefined);
  const anyLocked = fields.some((f) => lockedIds.has(f.mid));

  const applyTemplate = () => {
    const t = TEMPLATES[tpl];
    if (!t) return;
    const base = parseAmount(fixedAmount) ?? 0;
    replace(t.rows.map(([title, pct]) => ({ ...emptyRow(), title, amount: base > 0 ? String(Math.round((base * pct) / 100) / 100) : "" })));
  };

  return (
    <Section title="Milestones" level={3} id="pf-milestones" action={<span className="t-caption">{required ? "Required for this billing type" : "Optional"}</span>}>
      {!required && (
        <Switch
          label="Break this project into milestones"
          checked={enabled}
          disabled={anyLocked}
          onCheckedChange={(on) => (on ? replace([emptyRow(), emptyRow()]) : replace([]))}
        />
      )}
      {enabled && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Start from a template" htmlFor="pf-tpl" className="min-w-0 flex-1 basis-56 @2xl:max-w-xs">
              <SelectField
                id="pf-tpl" value={tpl} onValueChange={setTpl}
                options={[{ value: "", label: "None" }, ...Object.entries(TEMPLATES).map(([k, t]) => ({ value: k, label: t.label }))]}
              />
            </Field>
            <Button variant="outline" disabled={!tpl || anyLocked} onClick={applyTemplate}>Suggest milestones</Button>
          </div>

          <div>
            <LedgerHead cols={COLS}><span>Milestone</span><span>Amount ({currency})</span><span>Due</span><span /></LedgerHead>
            {fields.map((f, i) => {
              const e = errors.milestones?.[i];
              const locked = lockedIds.has(f.mid);
              return (
                <div key={f.id} role="group" aria-label={`Milestone ${i + 1}`} style={{ "--cols": COLS } as React.CSSProperties} className="grid items-start gap-x-3 gap-y-2 border-b border-border py-3 @2xl:grid-cols-[var(--cols)]">
                  <Field label={<span className="@2xl:sr-only">Milestone name</span>} htmlFor={`pf-ms-t${i}`} error={e?.title?.message}>
                    <Input id={`pf-ms-t${i}`} placeholder="Milestone name" aria-invalid={!!e?.title} aria-describedby={describedBy(`pf-ms-t${i}`, e?.title?.message, false)} {...register(`milestones.${i}.title`)} />
                  </Field>
                  <Field label={<span className="@2xl:sr-only">Amount ({currency})</span>} htmlFor={`pf-ms-a${i}`} error={e?.amount?.message}>
                    <Input id={`pf-ms-a${i}`} inputMode="decimal" className="num text-end" placeholder="0" aria-invalid={!!e?.amount} aria-describedby={describedBy(`pf-ms-a${i}`, e?.amount?.message, false)} {...register(`milestones.${i}.amount`)} />
                  </Field>
                  <Field label={<span className="@2xl:sr-only">Due date</span>} htmlFor={`pf-ms-d${i}`} error={e?.dueDate?.message}>
                    <Input id={`pf-ms-d${i}`} type="date" className="num" aria-invalid={!!e?.dueDate} aria-describedby={describedBy(`pf-ms-d${i}`, e?.dueDate?.message, false)} {...register(`milestones.${i}.dueDate`)} />
                  </Field>
                  <div className={cn("flex items-center gap-1 @2xl:pt-0")}>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move milestone ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move milestone ${i + 1} down`} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)}><ArrowDown aria-hidden="true" /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={locked ? `Milestone ${i + 1} is approved or invoiced and can’t be removed` : `Remove milestone ${i + 1}`} disabled={locked} onClick={() => remove(i)}><X aria-hidden="true" /></Button>
                  </div>
                </div>
              );
            })}
          </div>

          {listError && <p role="alert" className="text-xs text-error-ink">{listError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => append(emptyRow())}><Plus aria-hidden="true" />Add milestone</Button>
            <span role="status" className={cn("num text-sm", target !== null && target > 0 && !matches && "text-warning-ink")}>{sumText}</span>
          </div>
          <p className="text-xs text-muted-foreground">Each approved milestone becomes its own invoice. Clients approve or ask for changes with a comment through the share link.</p>
        </>
      )}
    </Section>
  );
}
