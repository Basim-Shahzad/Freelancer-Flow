import { describe, expect, it } from "vitest";
import { seedActivity, seedBusiness, seedClients, seedInvoices, seedMethods, seedProjects, seedTime } from "@/lib/seed";
import type { DataExport } from "@/lib/types";
import { buildExportJson, csvCell, exportFileName, exportPhase, formatBytes, invoicesToCsv, isExpired } from "./export-builder";

const src = { business: seedBusiness, clients: seedClients, projects: seedProjects, time: seedTime, invoices: seedInvoices, methods: seedMethods, activity: seedActivity };
const NOW = new Date("2026-10-05T12:00:00Z");

describe("buildExportJson", () => {
  const json = buildExportJson(src, NOW);
  it("contains every collection", () => {
    expect(json.clients).toHaveLength(seedClients.length);
    expect(json.invoices).toHaveLength(seedInvoices.length);
    expect(json.paymentMethods).toHaveLength(seedMethods.length);
    expect(json.activity).toHaveLength(seedActivity.length);
    expect(json.exportedAt).toBe(NOW.toISOString());
  });
  it("flattens payments with their invoice number and client", () => {
    const p = json.payments.find((x) => x.reference === "RA-4410");
    expect(p).toMatchObject({ invoiceNumber: "INV-0044", client: "Dua Studio", currency: "PKR", amount: 3000000 });
    expect(json.payments).toHaveLength(seedInvoices.reduce((n, i) => n + i.payments.length, 0));
  });
  it("adds totals without mutating the source", () => {
    const inv = json.invoices.find((i) => i.number === "INV-0042");
    expect(inv?.totals.total).toBe(125000);
    expect("totals" in (seedInvoices[0] ?? {})).toBe(false);
  });
  it("is JSON serialisable", () => {
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});

describe("csv", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(12.5)).toBe("12.5");
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
  });
  it("writes a header and one row per invoice with decimal amounts", () => {
    const csv = invoicesToCsv(seedInvoices, seedClients, seedProjects, "2026-10-05");
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Number,Client,Project/);
    expect(lines).toHaveLength(seedInvoices.length + 1);
    const row = lines.find((l) => l.startsWith("INV-0042"));
    expect(row).toContain("Harbor Labs,Mobile app,USD");
    expect(row).toContain("1250.00");
  });
});

describe("export state", () => {
  const x = (over: Partial<DataExport>): DataExport => ({ id: "x", requestedAt: NOW.toISOString(), status: "ready", fileName: "f.zip", sizeLabel: "1 MB", ...over });
  it("derives the phase", () => {
    expect(exportPhase(undefined, NOW.getTime())).toBe("idle");
    expect(exportPhase(x({ status: "preparing" }), NOW.getTime())).toBe("preparing");
    expect(exportPhase(x({}), NOW.getTime())).toBe("ready");
    expect(exportPhase(x({ requestedAt: "2026-09-01T00:00:00Z" }), NOW.getTime())).toBe("idle");
    expect(exportPhase(x({ status: "expired" }), NOW.getTime())).toBe("idle");
  });
  it("detects expiry", () => {
    expect(isExpired(x({ requestedAt: "2026-09-01T00:00:00Z" }), NOW.getTime())).toBe(true);
    expect(isExpired(x({}), NOW.getTime())).toBe(false);
  });
  it("names files by date", () => {
    expect(exportFileName("2026-10-05")).toBe("paylancr-export-2026-10-05.json");
    expect(exportFileName("2026-10-05", "csv")).toBe("paylancr-invoices-2026-10-05.csv");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});
