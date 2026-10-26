import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { responseToProject } from "@/lib/api/mappers/projects";
import { useMilestones } from "@/lib/hooks/milestones";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { milestoneResponseFixture, projectResponseFixture } from "@/lib/test/projects";
import { MilestonesPanel } from "./milestones-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Dialog uses a few DOM APIs jsdom does not have.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const project = responseToProject(projectResponseFixture({ billingType: "MILESTONE", milestonesEnabled: true, hourlyRate: null }));
const LIST = "/projects/p1/milestones/";
const rows = () => [
  milestoneResponseFixture({ id: "a", name: "Discovery", sortOrder: 0, amount: "500.00", status: "APPROVED", approvedAt: "2026-09-01T10:00:00Z" }),
  milestoneResponseFixture({ id: "b", name: "Design", sortOrder: 1, status: "IN_PROGRESS", dueDate: "2026-11-01T00:00:00Z" }),
  milestoneResponseFixture({ id: "c", name: "Build", sortOrder: 2, status: "PENDING", approvalRequired: true }),
];

function Harness() {
  const query = useMilestones("p1", "USD", true);
  return <MilestonesPanel project={project} query={query} today="2026-10-05" />;
}

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

describe("states", () => {
  it("shows a skeleton while loading", () => {
    m.mock.onGet(LIST).reply(() => new Promise(() => {}));
    renderWithProviders(<Harness />);
    expect(screen.getByRole("status", { name: "Loading milestones" })).toBeTruthy();
  });

  it("shows the empty state", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: [], total: 0 });
    renderWithProviders(<Harness />);
    expect(await screen.findByText(/No milestones yet/)).toBeTruthy();
  });

  it("shows an error with retry, and recovers", async () => {
    m.mock.onGet(LIST).replyOnce(500, { detail: "boom" });
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    renderWithProviders(<Harness />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Discovery")).toBeTruthy();
  });

  it("disables editing while offline", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    renderWithProviders(<Harness />);
    await screen.findByText("Discovery");
    useAppStore.setState({ online: false });
    await waitFor(() => expect(screen.getByRole("button", { name: /Add milestone/ })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Edit Design" })).toBeDisabled();
  });
});

describe("list", () => {
  it("shows state, amount and the actions the server allows", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    renderWithProviders(<Harness />);
    await screen.findByText("Discovery");
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByText("Not started")).toBeTruthy();
    expect(screen.getByText("Client approval required")).toBeTruthy();
    // Design (in progress, approval not required) can be approved by the freelancer; Build (approval required) cannot.
    expect(screen.getByRole("button", { name: "Mark approved" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Submit for approval" })).toHaveLength(2); // Design, Build; not the approved one
  });
});

describe("submit", () => {
  it("confirms, POSTs the submit, and reports success", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    m.mock.onPost("/milestones/c/submit").reply(200, milestoneResponseFixture({ id: "c", status: "SUBMITTED" }));
    renderWithProviders(<Harness />);
    await screen.findByText("Build");
    const row = screen.getByText("Build").closest("div.flex.flex-wrap")!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Submit for approval" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/doesn’t send any invoice/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(m.mock.history.post.map((r) => r.url)).toEqual(["/milestones/c/submit"]));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("surfaces the server's message when the milestone cannot be submitted (409)", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    m.mock.onPost("/milestones/c/submit").reply(409, { detail: "Cannot submit milestone in status APPROVED" });
    renderWithProviders(<Harness />);
    await screen.findByText("Build");
    const row = screen.getByText("Build").closest("div.flex.flex-wrap")!.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Submit for approval" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for approval" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cannot submit milestone in status APPROVED"));
  });
});

describe("status moves and reorder", () => {
  it("PATCHes the new status", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    m.mock.onPatch("/milestones/c").reply(200, milestoneResponseFixture({ id: "c", status: "IN_PROGRESS" }));
    renderWithProviders(<Harness />);
    await screen.findByText("Build");
    fireEvent.click(screen.getByRole("button", { name: "Start work" }));
    await waitFor(() => expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ status: "IN_PROGRESS" }));
  });

  it("reorders optimistically and PUTs every id", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    m.mock.onPut("/projects/p1/milestones/order").reply(200, { milestones: [rows()[1], rows()[0], rows()[2]], total: 3 });
    renderWithProviders(<Harness />);
    await screen.findByText("Design");
    fireEvent.click(screen.getByRole("button", { name: "Move Design up" }));
    await waitFor(() => expect(JSON.parse(m.mock.history.put[0]!.data)).toEqual({ milestoneIds: ["b", "a", "c"] }));
  });

  it("reports a failed reorder and keeps the old order", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: rows(), total: 3 });
    m.mock.onPut("/projects/p1/milestones/order").reply(422, { detail: "Send every milestone id exactly once" });
    renderWithProviders(<Harness />);
    await screen.findByText("Design");
    fireEvent.click(screen.getByRole("button", { name: "Move Design up" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Send every milestone id exactly once"));
    const names = await waitFor(() => screen.getAllByRole("button", { name: /^Edit / }).map((b) => b.getAttribute("aria-label")));
    expect(names).toEqual(["Edit Discovery", "Edit Design", "Edit Build"]);
  });
});

describe("add a milestone", () => {
  it("shows the server's 422 when milestones are not enabled for the project", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: [], total: 0 });
    m.mock.onPost("/milestones").reply(422, { detail: "Milestones are not enabled for this project" });
    renderWithProviders(<Harness />);
    await screen.findByText(/No milestones yet/);
    fireEvent.click(screen.getByRole("button", { name: /Add milestone/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Design" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add milestone" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Milestones are not enabled for this project");
    expect(JSON.parse(m.mock.history.post[0]!.data)).toMatchObject({ name: "Design", projectId: "p1", amount: null, dueDate: null });
  });

  it("maps a field-level 422 onto the form", async () => {
    m.mock.onGet(LIST).reply(200, { milestones: [], total: 0 });
    m.mock.onPost("/milestones").reply(422, { detail: [{ loc: ["body", "name"], msg: "Name is too long", type: "value_error" }] });
    renderWithProviders(<Harness />);
    await screen.findByText(/No milestones yet/);
    fireEvent.click(screen.getByRole("button", { name: /Add milestone/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Design" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add milestone" }));
    expect(await within(dialog).findByText("Name is too long")).toBeTruthy();
  });
});
