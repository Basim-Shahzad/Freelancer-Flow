"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LCell, LedgerRow, LMain, LSub } from "@/components/ui/ledger";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { methodSummary, methodTitle } from "@/lib/payment-methods";
import type { PaymentMethod } from "@/lib/types";

export const METHOD_COLS = "2.5rem minmax(0,2fr) minmax(0,1.2fr) auto";

interface Props {
  method: PaymentMethod;
  index: number;
  count: number;
  selected: boolean;
  onToggle: () => void;
  onMakeDefault: () => void;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
}

export function MethodRow({ method: m, index, count, selected, onToggle, onMakeDefault, onMove, onEdit }: Props) {
  const title = methodTitle(m);
  const summary = methodSummary(m);
  return (
    <LedgerRow cols={METHOD_COLS} selected={selected}>
      <LCell narrow="hide" className="num text-sm text-muted-foreground">{index + 1}</LCell>
      <LCell>
        <LMain className="flex flex-wrap items-center gap-2">{title}{m.isDefault && <Tag tone="primary">Default</Tag>}</LMain>
        <LSub>{summary || "No details yet"}{!m.enabled && " · not shown on invoices"}</LSub>
      </LCell>
      <LCell narrow="full" className="flex flex-wrap items-center gap-x-4">
        <Switch
          checked={m.enabled}
          onCheckedChange={onToggle}
          aria-label={`Show ${title} on invoices`}
          label={<span className="@2xl:sr-only">On invoices</span>}
        />
        {!m.isDefault && <Button variant="ghost" size="sm" className="min-h-11" onClick={onMakeDefault}>Make default</Button>}
      </LCell>
      <LCell end className="col-start-2 row-start-1 flex @2xl:col-auto @2xl:row-auto">
        <Button variant="ghost" size="icon" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Move ${title} down`} disabled={index === count - 1} onClick={() => onMove(1)}><ChevronDown aria-hidden="true" /></Button>
        <Button variant="ghost" aria-label={`Edit ${title}`} aria-expanded={selected} onClick={onEdit}>Edit</Button>
      </LCell>
    </LedgerRow>
  );
}
