import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { BusinessView } from "./business-view";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  vi.clearAllMocks();
  m = mockApi();
  useAppStore.setState({ online: true, hydrated: true });
});
afterEach(() => m.restore());

const edit = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("BusinessView", () => {
  it("shows a loading state, then the profile from the API", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture({ businessName: "Acme Ltd" }));
    renderWithProviders(<BusinessView />);
    expect(screen.queryByLabelText("Business name")).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByLabelText("Billing email")).toHaveAttribute("readonly");
  });

  it("shows an error with retry when the profile fails to load", async () => {
    m.mock.onGet("/profile").reply(500, { detail: "boom" });
    renderWithProviders(<BusinessView />);
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("saves API fields with PATCH /profile and toasts", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(200, profileFixture({ businessName: "Renamed" }));
    renderWithProviders(<BusinessView />);
    await screen.findByDisplayValue("Malik Studio");
    edit("Business name", "Renamed");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Business profile saved"));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toMatchObject({ businessName: "Renamed" });
  });

  it("maps a 422 onto the matching form field", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    m.mock.onPatch("/profile").reply(422, { detail: [{ loc: ["body", "businessAddress"], msg: "Address is too long" }] });
    renderWithProviders(<BusinessView />);
    await screen.findByDisplayValue("Malik Studio");
    edit("Address", "Somewhere else");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Address is too long")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not send anything while offline", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    renderWithProviders(<BusinessView />);
    await screen.findByDisplayValue("Malik Studio");
    edit("Business name", "Renamed");
    act(() => useAppStore.setState({ online: false }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(m.mock.history.patch).toHaveLength(0);
  });
});
