"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAppStore } from "@/lib/store";
import { ExportDialog } from "./export-dialog";

export function ExportView() {
  const online = useAppStore((s) => s.online);
  const [open, setOpen] = useState(false);

  return (
    <Section title="Export my data" id="st-x" className="max-w-[44rem]">
      <p className="text-sm text-muted-foreground">
        A ZIP of everything you’ve entered: JSON for each record type, CSVs for invoices, payments, time entries and expenses, your invoice PDFs and a manifest. Yours to keep, any time.
      </p>
      <div className="flex flex-col gap-2">
        <div><Button onClick={() => setOpen(true)} disabled={!online}><Download aria-hidden="true" />Export my data</Button></div>
        {!online && <p className="text-xs text-muted-foreground">You’re offline. Reconnect to export your data.</p>}
      </div>
      <ExportDialog open={open} onOpenChange={setOpen} />
    </Section>
  );
}
