"use client";

import { Bell, MoreHorizontal, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isLive } from "@/lib/invoice";
import type { InvoiceStatus } from "@/lib/types";

export type PanelKind = "remind" | "record" | "writeoff" | "reverse" | "cancel";

interface Props {
  status: InvoiceStatus;
  offline: boolean;
  panel: PanelKind | null;
  onSend: () => void;
  onPanel: (p: PanelKind) => void;
}

/**
 * Rail actions. Primary + outline pills for the main next step; everything else (share, write off, reverse
 * write-off, cancel) lives in "More". Actions that need a connection are disabled offline. The server decides
 * whether a transition is valid (409), so "Cancel invoice" is offered on anything not paid or closed.
 */
export function ActionBar({ status, offline, panel, onSend, onPanel }: Props) {
  const draft = status === "draft";
  const live = isLive(status);
  const writtenOff = status === "written_off";
  const closed = writtenOff || status === "void";
  const toggle = (p: PanelKind) => ({ "aria-expanded": panel === p, "aria-controls": `panel-${p}`, onClick: () => onPanel(p) });
  const canCancel = !closed && status !== "paid";
  const canShare = !draft && status !== "void";
  const hasMore = canShare || live || writtenOff || canCancel;

  return (
    <div role="toolbar" aria-label="Invoice actions" className="flex flex-col gap-2 print:hidden">
      {draft && <Button block disabled={offline} onClick={onSend}><Send aria-hidden="true" />Send invoice</Button>}
      {live && <Button block disabled={offline} {...toggle("record")}>Record payment</Button>}
      {live && <Button block variant="outline" disabled={offline} {...toggle("remind")}><Bell aria-hidden="true" />Send a reminder</Button>}
      {hasMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button block variant={draft || live ? "ghost" : "outline"}><MoreHorizontal aria-hidden="true" />More</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canShare && <DropdownMenuItem disabled={offline} onSelect={onSend}><Share2 className="size-4" aria-hidden="true" />Share invoice</DropdownMenuItem>}
            {canShare && (live || writtenOff || canCancel) && <DropdownMenuSeparator />}
            {live && <DropdownMenuItem disabled={offline} onSelect={() => onPanel("writeoff")}>Write off</DropdownMenuItem>}
            {writtenOff &&<DropdownMenuItem disabled={offline} onSelect={() => onPanel("reverse")}>Reverse write-off</DropdownMenuItem>}
            {canCancel && <DropdownMenuItem destructive disabled={offline} onSelect={() => onPanel("cancel")}>Cancel invoice</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
