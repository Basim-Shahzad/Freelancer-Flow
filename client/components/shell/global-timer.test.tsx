import { fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { projectResponseFixture } from "@/lib/test/projects";
import { runningEntryFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import { useOutbox } from "@/lib/time/outbox-store";
import { GlobalTimer } from "./global-timer";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  useOutbox.getState().reset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  m.mock.onGet("/projects").reply(200, { projects: [projectResponseFixture()], total: 1 });
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

const startButton = () => screen.getByRole("button", { name: "Start" });
async function pickProject() {
  fireEvent.click(await screen.findByLabelText("Project"));
  fireEvent.click(await screen.findByRole("option", { name: /Mobile app/ }));
}

describe("idle", () => {
  it("disables Start until a project is picked", async () => {
    m.mock.onGet("/time-entries/running").reply(200, null);
    renderWithProviders(<GlobalTimer />);
    await waitFor(() => expect(m.mock.history.get.some((r) => r.url === "/time-entries/running")).toBe(true));
    expect(startButton()).toBeDisabled();
    await pickProject();
    await waitFor(() => expect(startButton()).toBeEnabled());
  });

  it("starts a timer with the chosen project and description", async () => {
    m.mock.onGet("/time-entries/running").replyOnce(200, null);
    m.mock.onGet("/time-entries/running").reply(200, runningEntryFixture({ description: "Checkout QA" }));
    m.mock.onPost("/time-entries/start").reply(201, runningEntryFixture({ description: "Checkout QA" }));
    renderWithProviders(<GlobalTimer />);
    await pickProject();
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Checkout QA" } });
    await waitFor(() => expect(startButton()).toBeEnabled());
    fireEvent.click(startButton());
    expect(await screen.findByRole("button", { name: "Stop" })).toBeTruthy();
    expect(JSON.parse(m.mock.history.post[0]!.data)).toMatchObject({ projectId: "p1", description: "Checkout QA", isBillable: true });
  });

  it("shows the server's message when a timer is already running (409)", async () => {
    m.mock.onGet("/time-entries/running").reply(200, null);
    m.mock.onPost("/time-entries/start").reply(409, { detail: "A timer is already running" });
    renderWithProviders(<GlobalTimer />);
    await pickProject();
    await waitFor(() => expect(startButton()).toBeEnabled());
    fireEvent.click(startButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A timer is already running"));
  });

  it("keeps an offline start in the outbox", async () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/time-entries/running").reply(() => new Promise(() => {}));
    renderWithProviders(<GlobalTimer />);
    await pickProject();
    await waitFor(() => expect(startButton()).toBeEnabled());
    fireEvent.click(startButton());
    expect(await screen.findByRole("button", { name: "Stop" })).toBeTruthy();
    expect(m.mock.history.post).toHaveLength(0);
    expect(useOutbox.getState().items).toHaveLength(1);
  });
});

describe("running", () => {
  it("shows the running entry, locks its fields and stops it", async () => {
    m.mock.onGet("/time-entries/running").replyOnce(200, runningEntryFixture({ description: "Running task" }));
    m.mock.onGet("/time-entries/running").reply(200, null);
    m.mock.onPost("/time-entries/entry/r1/stop").reply(200, timeEntryResponseFixture({ id: "r1", durationMinutes: 84 }));
    renderWithProviders(<GlobalTimer />);
    expect(await screen.findByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.getByLabelText("Description")).toHaveValue("Running task");
    expect(screen.getByLabelText("Description")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved 1h 24m", expect.anything()));
    expect(await screen.findByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("keeps a stop offline in the outbox", async () => {
    m.mock.onGet("/time-entries/running").reply(200, runningEntryFixture());
    renderWithProviders(<GlobalTimer />);
    const stop = await screen.findByRole("button", { name: "Stop" });
    useAppStore.setState({ online: false });
    fireEvent.click(stop);
    await waitFor(() => expect(useOutbox.getState().items).toHaveLength(1));
    expect(useOutbox.getState().items[0]).toMatchObject({ id: "r1", seenUpdatedAt: "2026-10-05T10:00:00Z" });
    expect(useOutbox.getState().items[0]!.endAt).not.toBeNull();
    expect(m.mock.history.post).toHaveLength(0);
  });
});
