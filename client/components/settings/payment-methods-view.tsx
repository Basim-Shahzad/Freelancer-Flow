"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { OfflineNotice } from "@/components/dashboard/offline-notice";
import { QueryBoundary } from "@/components/domain/query-boundary";
import { StateBlock } from "@/components/domain/state-block";
import { PaymentMethodForm, type MethodDraft } from "@/components/domain/payment-method-form";
import { mapMethodErrors, type MethodErrors } from "@/components/domain/payment-method-errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { SelectField } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { LedgerHead, LCell } from "@/components/ui/ledger";
import { Section, Split } from "@/components/ui/section";
import { toCreate, toUpdate } from "@/lib/api/mappers/payment-methods";
import {
  useCreatePaymentMethod, useDeletePaymentMethod, usePaymentMethods, useReorderPaymentMethods, useSetDefaultPaymentMethod, useTogglePaymentMethod,
  useUpdatePaymentMethod,
} from "@/lib/hooks/payment-methods";
import { METHOD_KINDS, fieldsFor, methodTitle } from "@/lib/payment-methods";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/services/api.service";
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
  const query = usePaymentMethods();
  if (!query.data) {
    const rateLimited = query.isError && getApiErrorStatus(query.error) === 429;
    return (
      <Split>
        <Section title="Payment methods" id="st-m">
          {rateLimited ? (
            <StateBlock kind="error" title="Too many requests" body="You’re going a little fast. Try again in a moment." cta={{ label: query.isFetching ? "Retrying…" : "Try again", onClick: () => void query.refetch() }} />
          ) : (
            <QueryBoundary query={query} isEmpty={() => false} loading={<SettingsSkeleton />}>{() => null}</QueryBoundary>
          )}
        </Section>
      </Split>
    );
  }
  return <Loaded methods={query.data} />;
}

function Loaded({ methods }: { methods: PaymentMethod[] }) {
  const online = useAppStore((s) => s.online);
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const remove = useDeletePaymentMethod();
  const reorder = useReorderPaymentMethods();
  const setDefault = useSetDefaultPaymentMethod();
  const toggle = useTogglePaymentMethod();

  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState<MethodDraft | null>(null);
  const [saveErrors, setSaveErrors] = useState<MethodErrors | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PaymentMethod | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const key = editingKey(editing);
  useEffect(() => { if (key) panelRef.current?.scrollIntoView?.({ block: "nearest" }); }, [key]);

  const startEdit = (e: Editing | null) => { setDraft(null); setSaveErrors(null); setEditing(e); };
  const preview = useMemo(() => previewMethods(methods, editing, draft), [methods, editing, draft]);
  const addable = useMemo(() => addableKinds(methods), [methods]);

  const enabledCount = methods.filter((m) => m.enabled).length;
  const editingMethod = editing?.mode === "edit" ? methods.find((m) => m.id === editing.id) : undefined;
  const saving = create.isPending || update.isPending;
  // Row controls wait for an in-flight change, and for a connection.
  const rowsLocked = toggle.isPending || setDefault.isPending || reorder.isPending || !online;

  const save = async (d: MethodDraft) => {
    setSaveErrors(null);
    try {
      if (editing?.mode === "edit" && editingMethod) {
        await update.mutateAsync({ id: editingMethod.id, body: toUpdate(d) });
        toast.success(`${methodTitle(d)} saved`);
      } else if (editing?.mode === "new") {
        await create.mutateAsync(toCreate(d));
        toast.success(`${methodTitle(d)} added to your invoices`);
      }
      startEdit(null);
    } catch (e) {
      const mapped = mapMethodErrors(e, ["label", ...fieldsFor(d.kind, d.scheme).map((f) => f.key)]);
      if (mapped) setSaveErrors(mapped);
      else toast.error(getApiErrorMessage(e, "Couldn’t save this payment method."));
    }
  };

  const makeDefault = (m: PaymentMethod) =>
    setDefault.mutate({ id: m.id, isActive: m.enabled }, {
      onSuccess: () => toast.success(`${methodTitle(m)} is now your default`),
      onError: (e) => toast.error(getApiErrorMessage(e, "Couldn’t change your default method.")),
    });

  const move = (m: PaymentMethod, i: number, dir: -1 | 1) => {
    const ids = methods.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids, {
      onSuccess: () => setAnnounce(`${methodTitle(m)} moved to position ${j + 1} of ${methods.length}`),
      onError: (e) => toast.error(getApiErrorMessage(e, "Couldn’t reorder your payment methods.")),
    });
  };

  const flip = (m: PaymentMethod) =>
    toggle.mutate({ id: m.id, isActive: !m.enabled }, { onError: (e) => toast.error(getApiErrorMessage(e, "Couldn’t update this payment method.")) });

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(confirmDelete.id);
      toast.success(`${methodTitle(confirmDelete)} deleted`);
      setConfirmDelete(null);
      startEdit(null);
    } catch (e) {
      setDeleteError(getApiErrorMessage(e, "Couldn’t delete this payment method."));
    }
  };

  const panel = (
    <div ref={panelRef} className="flex flex-col gap-4 border-b border-rule bg-hover/40 p-4">
      {editing && (
        <PaymentMethodForm
          key={key}
          kind={editing.mode === "edit" ? (editingMethod?.kind ?? "other") : editing.kind}
          initial={editingMethod}
          submitLabel={editing.mode === "new" ? "Add method" : "Save method"}
          submitting={saving}
          errors={saveErrors}
          onSubmit={(d) => void save(d)}
          onCancel={() => startEdit(null)}
          onChange={setDraft}
        />
      )}
      {editingMethod && (
        <div className="border-t border-border pt-4">
          <Button variant="destructive" size="sm" disabled={!online} onClick={() => { setDeleteError(null); setConfirmDelete(editingMethod); }}>Delete this method</Button>
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
        <OfflineNotice detail="Payment methods can’t be changed until you’re back online." />

        {methods.length === 0 ? (
          <StateBlock
            kind="empty"
            title="No payment methods yet"
            body="Add the ways clients can pay you. They appear on every invoice as instructions with copy buttons."
            cta={{ label: "Add a method", onClick: () => document.getElementById("st-add")?.focus() }}
          />
        ) : (
          <div role="table" aria-label="Payment methods" aria-busy={rowsLocked}>
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
                  disabled={rowsLocked}
                  onToggle={() => flip(m)}
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
            disabled={!online}
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
            It will no longer be offered on new invoices. Invoices you’ve already sent keep the instructions they were sent with. To keep it but hide it, turn off “On invoices” instead.
          </DialogDescription>
          {deleteError && <Notice tone="error">{deleteError}</Notice>}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="ghost">Keep it</Button></DialogClose>
            <Button variant="destructive" loading={remove.isPending} onClick={() => void confirmRemove()}>Delete method</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Split>
  );
}
