"use client";

import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { KV, Section } from "@/components/ui/section";
import { addDays, fmtDate, isoDate, parse } from "@/lib/dates";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import type { DataExport } from "@/lib/types";
import { downloadText } from "./download";
import { buildExportJson, EXPORT_TTL_DAYS, exportFileName, exportPhase, formatBytes, invoicesToCsv, isExpired } from "./export-builder";
import { SettingsSkeleton } from "./settings-skeleton";

/** Simulated preparation time before an export flips to "ready". */
const PREPARE_MS = 2500;

function snapshot() {
  const s = useAppStore.getState();
  return { business: s.business, clients: s.clients, projects: s.projects, time: s.time, invoices: s.invoices, methods: s.methods, activity: s.activity };
}

function downloadJson(x: DataExport) {
  const json = JSON.stringify(buildExportJson(snapshot()), null, 2);
  downloadText(exportFileName(x.requestedAt), json, "application/json");
  toast.success("Export downloaded");
}

function downloadCsv(x: DataExport) {
  const s = snapshot();
  downloadText(exportFileName(x.requestedAt, "csv"), invoicesToCsv(s.invoices, s.clients, s.projects), "text/csv");
  toast.success("Invoices CSV downloaded");
}

export function ExportView() {
  const hydrated = useHydrated();
  const exports = useAppStore((s) => s.exports);
  const email = useAppStore((s) => s.business.email);
  const online = useAppStore((s) => s.online);
  const requestExport = useAppStore((s) => s.requestExport);
  const finishExport = useAppStore((s) => s.finishExport);
  const [now] = useState(() => Date.now());

  const latest = exports[0];
  const phase = exportPhase(latest, now);
  const preparingId = phase === "preparing" ? latest?.id : undefined;
  const preparingSince = phase === "preparing" && latest ? new Date(latest.requestedAt).getTime() : 0;

  // Finish ~2.5s after the request, even if the page was reloaded while preparing.
  useEffect(() => {
    if (!preparingId) return;
    const wait = Math.max(0, PREPARE_MS - (Date.now() - preparingSince));
    const t = setTimeout(() => finishExport(preparingId), wait);
    return () => clearTimeout(t);
  }, [preparingId, preparingSince, finishExport]);

  if (!hydrated) return <SettingsSkeleton rows={3} />;

  const active = phase === "idle" ? undefined : latest;
  const past = exports.filter((x) => x.id !== active?.id);
  const expiry = active ? fmtDate(isoDate(addDays(parse(active.requestedAt), EXPORT_TTL_DAYS))) : "";

  const request = () => { requestExport(); };

  return (
    <Section title="Export my data" id="st-x" className="max-w-[44rem]">
      <p className="text-sm text-muted-foreground">
        Everything you’ve entered, as a JSON copy plus a CSV of your invoices: clients, projects, time, invoices, payments, payment methods and the activity log. Yours to keep, any time.
      </p>

      {phase === "idle" && (
        <div className="flex flex-col gap-2">
          <div><Button onClick={request} disabled={!online}>Request export</Button></div>
          {!online && <p className="text-xs text-muted-foreground">You’re offline. Reconnect to request an export.</p>}
        </div>
      )}

      {phase === "preparing" && (
        <Notice tone="info">
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 size-[1.125rem] shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span><b>Preparing your export…</b> This usually takes under a minute. You can leave this page; we’ll email {email} when it’s ready.</span>
          </div>
        </Notice>
      )}

      {phase === "ready" && active && (
        <>
          <Notice tone="ok">
            <b>Your export is ready.</b> <span className="num">{exportFileName(active.requestedAt)}</span> · {formatBytes(JSON.stringify(buildExportJson(snapshot())).length)}. Available until {expiry}.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadJson(active)}><Download aria-hidden="true" />Download JSON</Button>
            <Button variant="outline" onClick={() => downloadCsv(active)}><Download aria-hidden="true" />Download invoices (CSV)</Button>
            <Button variant="ghost" onClick={request} disabled={!online}>Request a new one</Button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 pt-4">
        <h3 className="t-h3">Past exports</h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No earlier exports.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {past.map((x) => {
              const expired = isExpired(x, now);
              return (
                <li key={x.id}>
                  <KV label={fmtDate(isoDate(parse(x.requestedAt)))}>
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="num">
                        {expired ? x.fileName : exportFileName(x.requestedAt)} · {expired ? x.sizeLabel : x.status === "preparing" ? "preparing" : "ready"}
                        {expired && <> · <span className="text-muted-foreground">expired</span></>}
                      </span>
                      {!expired && x.status === "ready" && (
                        <Button variant="ghost" size="sm" onClick={() => downloadJson(x)}><CheckCircle2 aria-hidden="true" />Download JSON</Button>
                      )}
                    </div>
                  </KV>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Section>
  );
}
