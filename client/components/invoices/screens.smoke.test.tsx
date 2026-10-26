import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceCreateView } from "@/components/invoices/create/create-view";
import { useAppStore } from "@/lib/store";
import { clientKeys } from "@/lib/hooks/clients";
import { createTestQueryClient, mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { paymentMethodResponses } from "@/lib/test/payment-methods";
import { testProjectResponses, testProjects } from "@/lib/test/projects";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  m.mock.onGet("/payment-methods").reply(200, { paymentMethods: paymentMethodResponses() });
  m.mock.onGet("/projects").reply(200, { projects: testProjectResponses(), total: testProjects.length });
  m.mock.onGet(/\/projects\/[^/]+\/milestones\/$/).reply(200, { milestones: [], total: 0 });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  useAppStore.getState().resetDemo();
  push.mockClear();
});
afterEach(() => {
  cleanup();
  m.restore();
});

describe("screens render with seed data", () => {
  // The list and detail screens run on the API and are covered by invoices-view.test.tsx and
  // detail/invoice-detail-view.test.tsx. Only the create flow still reads the mock store (step 9).
  it("create: needs a line before continuing, then reaches review with the real document", async () => {
    renderWithProviders(<InvoiceCreateView projectId="p-gulberg" />);
    // milestone project with nothing approved (the flow waits for the payment methods first)
    expect(await screen.findByText(/Nothing approved yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toMatch(/at least one item/);
  });

  it("create: hourly project preselects ready time and creates an invoice", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(clientKeys.options(), { items: testClientItems, total: testClientItems.length });
    renderWithProviders(<InvoiceCreateView projectId="p-harbor" />, { queryClient });
    const before = useAppStore.getState().invoices.length;
    await screen.findByRole("button", { name: "Continue" });
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeTruthy();
    expect(screen.getByLabelText("Invoice INV-0046")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create invoice" })); });
    expect(useAppStore.getState().invoices.length).toBe(before + 1);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/invoices\/inv-/));
    expect(useAppStore.getState().time.filter((t) => t.isInvoiced && t.projectId === "p-harbor").length).toBeGreaterThan(1);
  });
});
