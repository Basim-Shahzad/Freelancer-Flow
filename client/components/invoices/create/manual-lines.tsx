"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LCell, LedgerHead, LedgerRow } from "@/components/ui/ledger";
import type { Currency } from "@/lib/types";
import { manualRowError, newManualRow, type ManualRow } from "./logic";
import { Label } from "@/components/ui/label";

const COLS = "minmax(0,3fr) minmax(0,1fr) minmax(0,1.2fr) 2.75rem";

interface Props { rows: ManualRow[]; currency: Currency; showErrors: boolean; onChange: (rows: ManualRow[]) => void }

export function ManualLines({ rows, currency, showErrors, onChange }: Props) {
  const set = (id: string, patch: Partial<ManualRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => { const next = rows.filter((r) => r.id !== id); onChange(next.length ? next : [newManualRow()]); };
  return (
    <div className="flex flex-col gap-3">
      <h3 className="t-h3 pt-3">Extra lines</h3>
      <div role="group" aria-label="Extra lines">
        <LedgerHead cols={COLS}><span>Description</span><span>Qty</span><span>Rate ({currency})</span><span /></LedgerHead>
        {rows.map((r, i) => {
          const err = showErrors ? manualRowError(r) : null;
          return (
            <div key={r.id}>
              <LedgerRow cols={COLS} role="group" className="@2xl:items-start">
                <LCell narrow="full">
                  <Label className="sr-only" htmlFor={`ml-d-${r.id}`}>Description, line {i + 1}</Label>
                  <Input id={`ml-d-${r.id}`} placeholder="e.g. Sprint planning workshop" value={r.description} onChange={(e) => set(r.id, { description: e.target.value })} aria-invalid={Boolean(err)} />
                </LCell>
                <LCell>
                  <Label className="sr-only" htmlFor={`ml-q-${r.id}`}>Quantity, line {i + 1}</Label>
                  <Input id={`ml-q-${r.id}`} inputMode="decimal" placeholder="1" value={r.qty} onChange={(e) => set(r.id, { qty: e.target.value })} aria-invalid={Boolean(err)} />
                </LCell>
                <LCell>
                  <Label className="sr-only" htmlFor={`ml-r-${r.id}`}>Rate in {currency}, line {i + 1}</Label>
                  <Input id={`ml-r-${r.id}`} inputMode="decimal" placeholder="0.00" value={r.rate} onChange={(e) => set(r.id, { rate: e.target.value })} aria-invalid={Boolean(err)} />
                </LCell>
                <LCell end>
                  <Button variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} onClick={() => remove(r.id)}><Trash2 aria-hidden="true" /></Button>
                </LCell>
              </LedgerRow>
              {err && <p role="alert" className="pb-2 text-xs text-error-ink">Line {i + 1}: {err}</p>}
            </div>
          );
        })}
      </div>
      <div><Button variant="ghost" size="sm" onClick={() => onChange([...rows, newManualRow()])}><Plus aria-hidden="true" />Add another line</Button></div>
    </div>
  );
}
