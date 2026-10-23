import { describe, expect, it } from "vitest";
import { clientFixture, clientListItemFixture } from "@/lib/test";
import { clientToCreate, clientToUpdate, listItemToClient, responseToClient, type ClientInput } from "./clients";

const input = (over: Partial<ClientInput> = {}): ClientInput => ({
  name: "Jordan Reyes", companyName: "Harbor Labs", email: "j@h.example", whatsapp: "", phone: "", address: "", taxId: "", currency: "USD", termsDays: 14, notes: "", ...over,
});

describe("client mappers", () => {
  it("maps `company` on list items and `companyName` on details", () => {
    expect(listItemToClient(clientListItemFixture({ company: "Harbor Labs" })).companyName).toBe("Harbor Labs");
    expect(responseToClient(clientFixture({ companyName: "Harbor Labs" })).companyName).toBe("Harbor Labs");
  });

  it("turns nulls into empty strings and falls back to the defaults", () => {
    const c = responseToClient(clientFixture({ companyName: null, email: null, phone: null, notes: null, currency: null, paymentTermsDays: null }), { currency: "PKR", termsDays: 30 });
    expect(c).toMatchObject({ companyName: "", email: "", phone: "", notes: "", currency: "PKR", termsDays: 30 });
  });

  it("keeps a zero payment term (due on receipt) and ignores unknown currencies", () => {
    expect(responseToClient(clientFixture({ paymentTermsDays: 0, currency: "XYZ" }), { currency: "EUR", termsDays: 14 })).toMatchObject({ termsDays: 0, currency: "EUR" });
  });

  it("returns the WhatsApp value the server sent, untouched", () => {
    expect(responseToClient(clientFixture({ whatsappNumber: "+923215550188" })).whatsapp).toBe("+923215550188");
  });

  it("keeps the embedded projects and masked tax id on list items", () => {
    const projects = [{ id: "p1", name: "Site", createdAt: "2026-02-01T00:00:00Z" }];
    expect(listItemToClient(clientListItemFixture({ projects, taxId: "****5678" }))).toMatchObject({ projects, taxId: "****5678" });
  });

  it("sends null for empty strings on create", () => {
    expect(clientToCreate(input({ companyName: "  ", whatsapp: "03215550188" }))).toEqual({
      name: "Jordan Reyes", email: "j@h.example", companyName: null, phone: null, whatsappNumber: "03215550188", address: null, taxId: null, notes: null,
      paymentTermsDays: 14, currency: "USD",
    });
  });

  it("updates only changed fields, clearing emptied ones with null", () => {
    const prev = input({ phone: "123", notes: "hello" });
    expect(clientToUpdate(input({ phone: "", notes: "hello", name: "J. Reyes" }), prev)).toEqual({ name: "J. Reyes", phone: null });
    expect(clientToUpdate(prev, prev)).toEqual({});
  });
});
