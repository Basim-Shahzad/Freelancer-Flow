import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, renderWithProviders } from "@/lib/test";
import { ActivityView } from "./activity-view";

let m: ReturnType<typeof mockApi>;
beforeEach(() => { m = mockApi(); useAppStore.setState({ online: true }); });
afterEach(() => m.restore());

const ev = (id: string, over = {}) => ({ id, entityType: "invoice", entityId: `i-${id}`, action: "update", summary: `Summary ${id}`, changes: null, createdAt: "2026-11-01T10:00:00Z", ...over });

describe("ActivityView", () => {
  it("shows loading then rows with links and changes", async () => {
    m.mock.onGet("/activity").reply(200, { events: [ev("a", { changes: { status: { old: "draft", new: "sent" }, tax_id: { old: "[redacted]", new: "[redacted]" } } })], total: 1, nextCursor: null });
    renderWithProviders(<ActivityView />);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    expect(await screen.findByText("Summary a")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view invoice/i })).toHaveAttribute("href", "/invoices/i-a");
    expect(screen.getByText("Status: draft → sent")).toBeInTheDocument();
    expect(screen.getByText("Tax id changed")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    m.mock.onGet("/activity").reply(200, { events: [], total: 0, nextCursor: null });
    renderWithProviders(<ActivityView />);
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    m.mock.onGet("/activity").replyOnce(500, { detail: "boom" }).onGet("/activity").reply(200, { events: [ev("a")], total: 1, nextCursor: null });
    renderWithProviders(<ActivityView />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Summary a")).toBeInTheDocument();
  });

  it("loads more and appends", async () => {
    m.mock.onGet("/activity").reply((c) => (c.params.cursor ? [200, { events: [ev("b")], total: 2, nextCursor: null }] : [200, { events: [ev("a")], total: 2, nextCursor: "c1" }]));
    renderWithProviders(<ActivityView />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Summary b")).toBeInTheDocument();
    expect(screen.getByText("Summary a")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("refetches with entity_type when the segment changes", async () => {
    m.mock.onGet("/activity").reply(200, { events: [ev("a")], total: 1, nextCursor: null });
    renderWithProviders(<ActivityView />);
    await screen.findByText("Summary a");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    await waitFor(() => expect(m.mock.history.get.some((r) => r.params.entity_type === "project")).toBe(true));
  });

  it("shows the offline state before anything loaded", async () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/activity").networkError();
    renderWithProviders(<ActivityView />);
    expect(await screen.findAllByText(/offline/i)).not.toHaveLength(0);
  });
});
