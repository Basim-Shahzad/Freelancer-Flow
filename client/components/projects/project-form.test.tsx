import { fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { responseToProject } from "@/lib/api/mappers/projects";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { projectResponseFixture } from "@/lib/test/projects";
import { ProjectForm } from "./project-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }), usePathname: () => "/projects/p1/edit" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Select uses a few DOM APIs jsdom does not have.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  push.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

const retainer = () => responseToProject(projectResponseFixture({
  billingType: "RETAINER", hourlyRate: null, retainerAmount: "1300.00", retainerInterval: "MONTHLY", retainerStartDate: "2026-09-01",
}));
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

describe("edit", () => {
  it("sends only what changed and returns to the project", async () => {
    m.mock.onPatch("/projects/p1").reply(200, projectResponseFixture({ name: "Renamed" }));
    renderWithProviders(<ProjectForm project={retainer()} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Renamed" } });
    save();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p1"));
    expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ name: "Renamed" });
  });

  it("shows the retainer fields for a retainer project and not the fixed price", () => {
    renderWithProviders(<ProjectForm project={retainer()} />);
    expect(screen.getByLabelText("Amount per period")).toHaveValue("1300.00");
    expect(screen.getByLabelText(/^Starts/)).toHaveValue("2026-09-01");
    expect(screen.queryByLabelText("Price")).toBeNull();
    expect(screen.queryByLabelText(/Percent complete/)).toBeNull(); // progress is computed by the server now
  });

  it("validates the retainer amount before sending anything", async () => {
    renderWithProviders(<ProjectForm project={retainer()} />);
    fireEvent.change(screen.getByLabelText("Amount per period"), { target: { value: "" } });
    save();
    expect(await screen.findByText("Enter the amount per period")).toBeTruthy();
    expect(m.mock.history.patch).toHaveLength(0);
  });

  it("maps a server 422 onto its field", async () => {
    m.mock.onPatch("/projects/p1").reply(422, { detail: [{ loc: ["body", "retainer_end_date"], msg: "retainer_end_date must be after retainer_start_date", type: "value_error" }] });
    renderWithProviders(<ProjectForm project={retainer()} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Renamed" } });
    save();
    expect(await screen.findByText("retainer_end_date must be after retainer_start_date")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("toasts when the project no longer exists (404)", async () => {
    m.mock.onPatch("/projects/p1").reply(404, { detail: "Project not found" });
    renderWithProviders(<ProjectForm project={retainer()} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Renamed" } });
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("does not save while offline", async () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<ProjectForm project={retainer()} />);
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Renamed" } });
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(m.mock.history.patch).toHaveLength(0);
  });
});

describe("create", () => {
  it("asks for a client and a price before posting anything", async () => {
    renderWithProviders(<ProjectForm project={undefined} />);
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Brand site" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Choose a client")).toBeTruthy();
    expect(screen.getByText("Enter the project price")).toBeTruthy();
    expect(m.mock.history.post).toHaveLength(0);
  });
});
