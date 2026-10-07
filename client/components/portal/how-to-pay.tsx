"use client";

import { ExternalLink, Info } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { useCopy } from "@/lib/hooks/use-copy";
import { fieldsFor, METHOD_KINDS, methodTitle } from "@/lib/payment-methods";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CLIENT_INTRO, safeHttpUrl } from "./portal-logic";

type Copy = ReturnType<typeof useCopy>;

/** One labelled value. Value is the FULL, unmasked text. `copyKey` null = no copy button. */
function CopyRow({ label, value, copyKey, copy, multiline }: { label: string; value: string; copyKey: string | null; copy: Copy; multiline?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 border-b border-border py-2 @md:grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)_auto]", !copyKey && "grid-cols-[minmax(0,1fr)] @md:grid-cols-[minmax(4.5rem,7rem)_minmax(0,1fr)]")}>
      <span className="col-span-full text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground @md:col-span-1">{label}</span>
      <span className={cn("num min-w-0 break-all text-base font-semibold", multiline && "whitespace-pre-line break-words")}>{value}</span>
      {copyKey && <CopyButton label={label} copied={copy.copied === copyKey} onCopy={() => void copy.copy(copyKey, value)} className="print:hidden" />}
    </div>
  );
}

function MethodBlock({ method, preferred, copy }: { method: PaymentMethod; preferred: boolean; copy: Copy }) {
  const title = methodTitle(method);
  const intro = CLIENT_INTRO[method.kind];
  const link = method.kind === "payoneer" ? safeHttpUrl(method.fields.link) : undefined;
  const fields = fieldsFor(method.kind, method.scheme).filter((f) => {
    if (!method.fields[f.key]) return false;
    if (method.kind === "payoneer" && f.key === "link") return false; // rendered as an outbound link below
    if (method.kind === "other" && f.key === "title") return false; // already the block title
    return true;
  });
  return (
    <div className="flex flex-col gap-0.5 border-t border-rule pb-4 pt-3">
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <h3 className="t-h3">{title}</h3>
        {preferred && <Tag>Preferred</Tag>}
      </div>
      {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      {fields.map((f) => (
        <CopyRow
          key={f.key}
          label={f.label}
          value={method.fields[f.key] ?? ""}
          copyKey={f.copy === false ? null : `${method.id}:${f.key}`}
          copy={copy}
          multiline={f.multiline}
        />
      ))}
      {link && (
        <div className="pt-3 print:hidden">
          <Button asChild variant="outline">
            <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open {METHOD_KINDS.payoneer.label} payment request<span className="sr-only"> (opens in a new tab)</span></a>
          </Button>
        </div>
      )}
    </div>
  );
}

export function HowToPay({ methods, number, ownerFirst }: { methods: PaymentMethod[]; number: string; ownerFirst: string }) {
  const copy = useCopy();
  return (
    <Section title="How to pay" id="pi-pay">
      <div role="note" className="flex items-start gap-3 border-y border-border py-3 text-sm">
        <Info className="mt-0.5 size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
        <span><b>Paylancr does not process payments.</b> Pay the freelancer directly using the details below. Use <b className="num">{number}</b> as the payment reference.</span>
      </div>
      <CopyRow label="Payment reference" value={number} copyKey="reference" copy={copy} />
      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment details are available on this invoice. Please contact {ownerFirst} to find out how to pay.</p>
      ) : (
        methods.map((m, i) => <MethodBlock key={m.id} method={m} preferred={i === 0 && methods.length > 1} copy={copy} />)
      )}
      <p className="t-caption">Once you’ve paid, no need to tell us here. {ownerFirst} records payments when the money arrives.</p>
    </Section>
  );
}
