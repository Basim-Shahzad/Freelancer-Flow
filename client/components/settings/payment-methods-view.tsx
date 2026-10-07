"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { StateBlock } from "@/components/domain/state-block";
import { PaymentMethodForm, type MethodDraft } from "@/components/domain/payment-method-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { LedgerHead, LCell } from "@/components/ui/ledger";
import { Section, Split } from "@/components/ui/section";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { METHOD_KINDS, methodTitle } from "@/lib/payment-methods";
import { useAppStore } from "@/lib/store";
import type { PaymentMethod, PaymentMethodKind } from "@/lib/types";
import { METHOD_COLS, MethodRow } from "./method-row";
import { MethodPreview } from "./method-preview";
import { editingKey, previewMethods, type Editing } from "./preview-methods";
import { SettingsSkeleton } from "./settings-skeleton";

/** Kinds that can still be added: every kind not yet present, plus bank / other which may repeat. */
export function addableKinds(methods: PaymentMethod[]): PaymentMethodKind[] {
  const present = new Set(methods.map((m) => m.kind));
  return (Object.keys(METHOD_KINDS) as PaymentMethodKind[]).filter((k) => k === "bank" || k === "other" || !present.has(k));
}

export function PaymentMethodsView() {
  const hydrated = useHydrated();
  const methods = useAppStore((s) => s.methods);
  const upsertMethod = useAppStore((s) => s.upsertMethod);
  const removeMethod = useAppStore((s) => s.removeMethod);
  const moveMethod = useAppStore((s) => s.moveMethod);
  const setDefaultMethod = useAppStore((s) => s.setDefaultMethod);
  const toggleMethod = useAppStore((s) => s.toggleMethod);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState<MethodDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PaymentMethod | null>(null);
  const [announce, setAnnounce] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const key = editingKey(editing);
  useEffect(() => { if (key) panelRef.current?.scrollIntoView({ block: "nearest" }); }, [key]);

  const startEdit = (e: Editing | null) => { setDraft(null); setEditing(e); };
  const preview = useMemo(() => previewMethods(methods, editing, draft), [methods, editing, draft]);
  const addable = useMemo(() => addableKinds(methods), [methods]);

  if (!hydrated) return <SettingsSkeleton />;

  const enabledCount = methods.filter((m) => m.enabled).length;
  const editingMethod = editing?.mode === "edit" ? methods.find((m) => m.id === editing.id) : undefined;

  const save = (d: MethodDraft) => {
    if (editing?.mode === "edit" && editingMethod) {
      upsertMethod({ ...editingMethod, kind: d.kind, scheme: d.scheme, fields: d.fields, label: d.label });
      toast.success(`${methodTitle({ ...d })} saved`);
    } else if (editing?.mode === "new") {
      upsertMethod({ kind: d.kind, scheme: d.scheme, fields: d.fields, label: d.label, enabled: true, isDefault: false });
      toast.success(`${methodTitle({ ...d })} added to your invoices`);
    }
    startEdit(null);
  };

  const makeDefault = (m: PaymentMethod) => {
    setDefaultMethod(m.id);
    if (!m.enabled) toggleMethod(m.id);
    toast.success(`${methodTitle(m)} is now your default`);
  };

  const move = (m: PaymentMethod, i: number, dir: -1 | 1) => {
    moveMethod(m.id, dir);
    setAnnounce(`${methodTitle(m)} moved to position ${i + dir + 1} of ${methods.length}`);
  };

  const panel = (
    <div ref={panelRef} className="flex flex-col gap-4 border-b border-rule bg-hover/40 p-4">
      {editing && (
        <PaymentMethodForm
          key={key}
          kind={editing.mode === "edit" ? (editingMethod?.kind ?? "other") : editing.kind}
          initial={editingMethod}
          submitLabel={editing.mode === "new" ? "Add method" : "Save method"}
          onSubmit={save}
          onCancel={() => startEdit(null)}
          onChange={setDraft}
        />
      )}
      {editingMethod && (
        <div className="border-t border-border pt-4">
          <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(editingMethod)}>Delete this method</Button>
        </div>
      )}
    </div>
  );

  return (
    <Split>
      <Section
        title="Payment methods"
        id="st-m"
        action={<span className="text-sm text-muted-foreground">{enabledCount} on invoices</span>}
      >
        <p className="text-sm text-muted-foreground">
          Clients see these as instructions with copy buttons. Order here is the order on the invoice. Paylancr never holds or moves money.
        </p>

        {methods.length === 0 ? (
          <StateBlock
            kind="empty"
            title="No payment methods yet"
            body="Add the ways clients can pay you. They appear on every invoice as instructions with copy buttons."
            cta={{ label: "Add a method", onClick: () => document.getElementById("st-add")?.focus() }}
          />
        ) : (
          <div role="table" aria-label="Payment methods">
            <LedgerHead cols={METHOD_COLS}>
              <LCell role="columnheader">#</LCell><LCell role="columnheader">Method</LCell><LCell role="columnheader">On invoices</LCell><LCell role="columnheader" end>Order</LCell>
            </LedgerHead>
            {methods.map((m, i) => (
              <Fragment key={m.id}>
                <MethodRow
                  method={m}
                  index={i}
                  count={methods.length}
                  selected={editing?.mode === "edit" && editing.id === m.id}
                  onToggle={() => toggleMethod(m.id)}
                  onMakeDefault={() => makeDefault(m)}
                  onMove={(dir) => move(m, i, dir)}
                  onEdit={() => startEdit(editing?.mode === "edit" && editing.id === m.id ? null : { mode: "edit", id: m.id })}
                />
                {editing?.mode === "edit" && editing.id === m.id && <div role="row"><div role="cell">{panel}</div></div>}
              </Fragment>
            ))}
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>

        {editing?.mode === "new" && panel}

        <Field label="Add a method" htmlFor="st-add" className="max-w-md">
          <SelectField
            id="st-add"
            value=""
            placeholder="Choose a type…"
            onValueChange={(k) => { if (k) startEdit({ mode: "new", kind: k as PaymentMethodKind }); }}
            options={addable.map((k) => ({ value: k, label: `${METHOD_KINDS[k].label} · ${METHOD_KINDS[k].audience}` }))}
          />
        </Field>
      </Section>

      <MethodPreview methods={preview} />

      <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogTitle>Delete {confirmDelete ? methodTitle(confirmDelete) : "method"}?</DialogTitle>
          <DialogDescription>
            It will no longer be listed under “How to pay” on any invoice, including ones you’ve already sent. To keep it but hide it, turn off “On invoices” instead.
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="ghost">Keep it</Button></DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDelete) return;
                removeMethod(confirmDelete.id);
                toast.success(`${methodTitle(confirmDelete)} deleted`);
                setConfirmDelete(null);
                startEdit(null);
              }}
            >
              Delete method
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Split>
  );
}
