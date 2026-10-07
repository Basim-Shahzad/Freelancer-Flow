"use client";

import { Bell, Check, Link2, Mail, MessageCircle, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isLive } from "@/lib/invoice";
import type { InvoiceStatus } from "@/lib/types";

export type PanelKind = "remind" | "record" | "writeoff" | "reverse" | "void";

interface Props {
  status: InvoiceStatus;
  offline: boolean;
  copied: boolean;
  panel: PanelKind | null;
  onSendEmail: () => void;
  onWhatsApp: () => void;
  onCopy: () => void;
  onPanel: (p: PanelKind) => void;
}

/**
 * Rail actions. Primary + outline pills for the main next step; everything else (email, WhatsApp, copy link,
 * write off, reverse write-off, void) lives in "More". Actions that need a connection are disabled offline.
 */
export function ActionBar({ status, offline, copied, panel, onSendEmail, onWhatsApp, onCopy, onPanel }: Props) {
  const draft = status === "draft";
  const live = isLive(status);
  const closed = status === "written_off" || status === "void";
  const toggle = (p: PanelKind) => ({ "aria-expanded": panel === p, "aria-controls": `panel-${p}`, onClick: () => onPanel(p) });
  const canVoid = !closed && status !== "paid";
  const hasMore = status !== "void";

  return (
    <div role="toolbar" aria-label="Invoice actions" className="flex flex-col gap-2 print:hidden">
      {draft && <Button block disabled={offline} onClick={onSendEmail}><Mail aria-hidden="true" />Send by email</Button>}
      {live && <Button block disabled={offline} {...toggle("record")}>Record payment</Button>}
      {live && <Button block variant="outline" disabled={offline} {...toggle("remind")}><Bell aria-hidden="true" />Send a reminder</Button>}
      {hasMore && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button block variant={draft || live ? "ghost" : "outline"}><MoreHorizontal aria-hidden="true" />More</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {live && <DropdownMenuItem disabled={offline} onSelect={onSendEmail}><Mail className="size-4" aria-hidden="true" />Send by email</DropdownMenuItem>}
            {(draft || live || status === "paid") && <DropdownMenuItem disabled={offline} onSelect={onWhatsApp}><MessageCircle className="size-4" aria-hidden="true" />Share on WhatsApp</DropdownMenuItem>}
            {!draft && !closed && (
              <DropdownMenuItem onSelect={onCopy}>{copied ? <><Check className="size-4 text-success-ink" aria-hidden="true" />Link copied</> : <><Link2 className="size-4" aria-hidden="true" />Copy link</>}</DropdownMenuItem>
            )}
            {(live || status === "written_off" || canVoid) && <DropdownMenuSeparator />}
            {live && <DropdownMenuItem disabled={offline} onSelect={() => onPanel("writeoff")}>Write off</DropdownMenuItem>}
            {status === "written_off" && <DropdownMenuItem disabled={offline} onSelect={() => onPanel("reverse")}>Reverse write-off</DropdownMenuItem>}
            {canVoid && <DropdownMenuItem destructive disabled={offline} onSelect={() => onPanel("void")}>Void invoice</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
