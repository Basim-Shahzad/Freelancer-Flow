import { describe, expect, it } from "vitest";
import { seedClients, seedInvoices, seedProjects } from "@/lib/seed";
import { toInvoiceView } from "@/lib/selectors";
import { byNumberDesc, countLine, filterInvoices } from "./list-logic";

const views = seedInvoices.map((i) => toInvoiceView(i, seedClients, seedProjects)).sort(byNumberDesc);

describe("invoice list logic", () => {
  it("sorts newest number first", () => expect(views[0]?.number).toBe("INV-0045"));
  it("counts invoices and overdue", () => expect(countLine(views)).toBe("10 invoices · 1 overdue"));
  it("filters by status (unpaid includes partial)", () => {
    const unpaid = filterInvoices(views, { q: "", clientId: "all", status: "unpaid" }).map((v) => v.number);
    expect(unpaid).toContain("INV-0044");
    expect(unpaid).toContain("INV-0042");
    expect(filterInvoices(views, { q: "", clientId: "all", status: "draft" })).toHaveLength(1);
    expect(filterInvoices(views, { q: "", clientId: "all", status: "overdue" })[0]?.number).toBe("INV-0039");
  });
  it("searches number, client and project; filters by client", () => {
    expect(filterInvoices(views, { q: "0042", clientId: "all", status: "all" })).toHaveLength(1);
    expect(filterInvoices(views, { q: "gulberg", clientId: "all", status: "all" })).toHaveLength(1);
    expect(filterInvoices(views, { q: "retainer", clientId: "all", status: "all" })).toHaveLength(3);
    expect(filterInvoices(views, { q: "", clientId: "c-harbor", status: "all" })).toHaveLength(2);
  });
});
