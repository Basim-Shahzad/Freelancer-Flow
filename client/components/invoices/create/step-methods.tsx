"use client";

import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { Checkbox, ChoiceRow } from "@/components/ui/checkbox";
import { Tag } from "@/components/ui/tag";
import { methodSummary, methodTitle } from "@/lib/payment-methods";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props { methods: PaymentMethod[]; selected: string[]; error: string | null; onToggle: (id: string) => void }

export function StepMethods({ methods, selected, error, onToggle }: Props) {
  return (
    <section aria-labelledby="ic-4" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 id="ic-4" className="t-h2">How should they pay you?</h2>
        <Link href="/settings/payment-methods" className="text-sm font-medium text-primary-ink underline underline-offset-[3px]">Manage methods</Link>
      </div>
      <p className="text-sm text-muted-foreground">The client sees these as instructions with copy buttons. There is no pay button; Paylancr never moves money.</p>
      {methods.length === 0 && <Notice tone="warn"><b>No payment methods are enabled.</b> You can still create the invoice, but your client won’t see how to pay. <Link href="/settings/payment-methods" className="font-medium text-primary-ink underline underline-offset-[3px]">Add a method</Link>.</Notice>}
      <div role="group" aria-label="Payment methods">
        {methods.map((m) => {
          const on = selected.includes(m.id);
          return (
            <ChoiceRow key={m.id}>
              <Checkbox checked={on} onCheckedChange={() => onToggle(m.id)} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className={cn("font-medium", on && "font-bold")}>{methodTitle(m)}</span><br />
                <span className="t-caption">{methodSummary(m)}</span>
              </span>
              {m.isDefault && <Tag className="ms-auto">Default</Tag>}
            </ChoiceRow>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-error-ink">{error}</p>}
    </section>
  );
}
