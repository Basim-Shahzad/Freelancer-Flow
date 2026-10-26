import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { projectResponseFixture } from "@/lib/test/projects";
import { runningEntryFixture, timeEntryResponseFixture } from "@/lib/test/time-entries";
import { useOutbox } from "@/lib/time/outbox-store";
import { TimeView } from "./time-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/time" }));
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
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
  m.mock.onGet("/projects").reply(200, { projects: [projectResponseFixture()], total: 1 });
  m.mock.onGet("/time-entries/running").reply(200, null);
});
afterEach(() => {
  cleanup();
  m.restore();
  useAppStore.setState({ online: true });
});

const list = (...entries: ReturnType<typeof timeEntryResponseFixture>[]) => ({ timeEntries: entries, total: entries.length });

async function showList() {
  fireEvent.click(await screen.findByRole("button", { name: "List" }));
}

describe("states", () => {
  it("shows a loading state first", () => {
    m.mock.onGet("/time-entries/p1").reply(() => new Promise(() => {}));
    renderWithProviders(<TimeView />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });

  it("shows the empty state when nothing is logged", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list());
    renderWithProviders(<TimeView />);
    expect(await screen.findByText("No time logged yet")).toBeTruthy();
  });

  it("shows an error with a retry when the entries can't load", async () => {
    m.mock.onGet("/time-entries/p1").replyOnce(500, { detail: "Server exploded" });
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture()));
    renderWithProviders(<TimeView />);
    expect(await screen.findByText("Server exploded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await showList();
    expect(await screen.findAllByText("Checkout flow QA")).not.toHaveLength(0);
  });

  it("shows the offline state when it can't load and the device is offline", async () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/time-entries/p1").reply(() => new Promise(() => {}));
    renderWithProviders(<TimeView />);
    expect(await screen.findByText("You’re offline")).toBeTruthy();
  });
});

describe("entries", () => {
  it("fetches each project's entries and lists them by day, with the server's running timer", async () => {
    m.mock.onGet("/time-entries/running").reply(200, runningEntryFixture({ description: "Live task" }));
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture({ description: "Checkout flow QA" })));
    renderWithProviders(<TimeView />);
    await showList();
    expect(await screen.findByText("Checkout flow QA")).toBeTruthy();
    expect(screen.getByText("Live task")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop timer" })).toBeTruthy();
    expect(screen.getByText(/^This week ·/)).toBeTruthy();
  });

  it("shows an invoiced entry as locked", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture({ id: "t9", description: "Billed work", isInvoiced: true })));
    renderWithProviders(<TimeView />);
    await showList();
    expect((await screen.findAllByText("Invoiced")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Billed work is locked to an invoice/ }));
    expect(await screen.findByText(/on an invoice, so it is locked/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it("flags an entry the outbox holds as unsynced", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture()));
    useOutbox.getState().enqueue({
      type: "log", endAt: "2026-10-06T11:00:00.000Z",
      entry: { id: "q1", projectId: "p1", description: "Offline work", billable: true, startAt: "2026-10-06T10:00:00.000Z" },
    });
    renderWithProviders(<TimeView />);
    await showList();
    expect(await screen.findByText("Offline work")).toBeTruthy();
    expect(screen.getAllByText("Unsynced").length).toBeGreaterThan(0);
  });
});

describe("add entry", () => {
  it("needs a project before saving", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list());
    renderWithProviders(<TimeView />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Add time/ }))[0]!);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "No project" } });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save entry" })); });
    expect(await screen.findByText("Choose a project")).toBeTruthy();
    expect(m.mock.history.post).toHaveLength(0);
  });

  it("maps a 422 from the server onto the form", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list());
    m.mock.onPost("/time-entries").reply(422, { detail: [{ loc: ["body", "end_time"], msg: "End time cannot be in the future", type: "value_error" }] });
    renderWithProviders(<TimeView />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Add time/ }))[0]!);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Late entry" } });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText("Project"));
    fireEvent.click(await screen.findByRole("option", { name: /Mobile app/ }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save entry" })); });
    expect(await screen.findByText("End time cannot be in the future")).toBeTruthy();
    expect(JSON.parse(m.mock.history.post[0]!.data)).toMatchObject({ projectId: "p1", description: "Late entry" });
  });
});

describe("bulk edit", () => {
  const setup = async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture({ id: "t1", description: "First" }), timeEntryResponseFixture({ id: "t2", description: "Second" })));
    renderWithProviders(<TimeView />);
    await showList();
    fireEvent.click(await screen.findByRole("button", { name: "Select" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Select First" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Second" }));
  };

  it("sends one call for the whole selection", async () => {
    m.mock.onPatch("/time-entries/bulk").reply(200, { updated: 2 });
    await setup();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mark non-billable" })); });
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    const body = JSON.parse(m.mock.history.patch[0]!.data);
    expect(body.ids.sort()).toEqual(["t1", "t2"]);
    expect(body.set).toEqual({ isBillable: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Updated 2 entries"));
  });

  it("sets a description for the selection", async () => {
    m.mock.onPatch("/time-entries/bulk").reply(200, { updated: 2 });
    await setup();
    fireEvent.change(screen.getByLabelText("New description"), { target: { value: "  Sprint 4  " } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Set description" })); });
    await waitFor(() => expect(m.mock.history.patch).toHaveLength(1));
    expect(JSON.parse(m.mock.history.patch[0]!.data).set).toEqual({ description: "Sprint 4" });
  });

  it.each([
    [409, "An invoiced entry can only change its description"],
    [404, "Some time entries were not found"],
    [422, "Milestone does not belong to the target project"],
  ])("shows the server's message on a %i", async (status, detail) => {
    m.mock.onPatch("/time-entries/bulk").reply(status, { detail });
    await setup();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mark billable" })); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(detail));
  });

  it("deletes the selection one by one and reports entries the server refused", async () => {
    m.mock.onDelete("/time-entries/entry/t1").reply(204);
    m.mock.onDelete("/time-entries/entry/t2").reply(409, { detail: "Invoiced entries cannot be deleted" });
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete 2" }));
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Delete 2", hidden: false })); });
    await waitFor(() => expect(m.mock.history.delete).toHaveLength(2));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("1 could not be deleted. Invoiced entries cannot be deleted"));
    expect(toast.success).toHaveBeenCalledWith("1 entry deleted", expect.anything());
  });
});

describe("sync conflicts", () => {
  it("shows the server's reason and keeps the server version", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture({ id: "t1" })));
    useOutbox.setState({
      conflicts: [{
        item: { id: "t1", projectId: "p1", description: "My edit", billable: true, startAt: "2026-10-05T09:00:00.000Z", endAt: "2026-10-05T11:00:00.000Z", deleted: false, queuedAt: "2026-10-05T12:00:00.000Z" },
        reason: "server_newer", server: timeEntryResponseFixture({ id: "t1", description: "Server edit" }),
      }],
    });
    renderWithProviders(<TimeView />);
    expect(await screen.findByText("One entry changed in two places")).toBeTruthy();
    expect(screen.getByText(/changed on another device/)).toBeTruthy();
    expect(screen.getByText("Server edit")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep server" }));
    expect(screen.queryByText("One entry changed in two places")).toBeNull();
    expect(useOutbox.getState().conflicts).toHaveLength(0);
  });

  it("lists rejected items and lets the user discard them", async () => {
    m.mock.onGet("/time-entries/p1").reply(200, list(timeEntryResponseFixture()));
    useOutbox.setState({
      rejected: [{
        item: { id: "q9", projectId: "p1", description: "Too long", billable: true, startAt: "2026-10-05T09:00:00.000Z", endAt: "2026-10-07T11:00:00.000Z", deleted: false, queuedAt: "2026-10-05T12:00:00.000Z" },
        reason: "Duration cannot exceed 24 hours",
      }],
    });
    renderWithProviders(<TimeView />);
    expect(await screen.findByText("Duration cannot exceed 24 hours")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText("Duration cannot exceed 24 hours")).toBeNull();
  });
});
