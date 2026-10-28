import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { responseToProject } from "@/lib/api/mappers/projects";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { changeRequestResponseFixture } from "@/lib/test/change-requests";
import { projectResponseFixture } from "@/lib/test/projects";
import { ChangeRequestsPanel } from "./change-requests-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

const project = responseToProject(projectResponseFixture());
const LIST = "/change-requests";
const rows = () => [
  changeRequestResponseFixture({ id: "a", title: "Extra page", estimatedAmount: "600.00", estimatedHours: "6.00" }),
  changeRequestResponseFixture({ id: "b", title: "Logo tweak", status: "APPROVED", decidedAt: "2026-10-03T10:00:00Z", decisionNote: "Fine by them" }),
];
const reply = () => m.mock.onGet(LIST).reply(200, { changeRequests: rows(), total: 2 });
const rowOf = (title: string) => screen.getByText(title).closest("div.border-b") as HTMLElement;

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
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    expect(screen.getByRole("status", { name: "Loading scope changes" })).toBeTruthy();
  });

  it("shows the empty state", async () => {
    m.mock.onGet(LIST).reply(200, { changeRequests: [], total: 0 });
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    expect(await screen.findByText(/No scope changes yet/)).toBeTruthy();
  });

  it("shows an error with retry, and recovers", async () => {
    m.mock.onGet(LIST).replyOnce(500, { detail: "boom" });
    reply();
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Extra page")).toBeTruthy();
  });

  it("disables actions while offline", async () => {
    reply();
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    useAppStore.setState({ online: false });
    await waitFor(() => expect(screen.getByRole("button", { name: /Log scope change/ })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Edit Extra page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });
});

describe("list", () => {
  it("shows pending rows with actions and decided rows read-only", async () => {
    reply();
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    expect(m.mock.history.get[0]?.params).toMatchObject({ project_id: "p1" });
    expect(screen.getByText("Awaiting decision")).toBeTruthy();
    expect(screen.getByText("Note: Fine by them")).toBeTruthy();
    const decided = rowOf("Logo tweak");
    expect(within(decided).queryByRole("button", { name: /Edit|Approve|Reject|Withdraw/ })).toBeNull();
    expect(within(decided).getByRole("button", { name: "Delete Logo tweak" })).toBeTruthy();
    expect(within(rowOf("Extra page")).getByRole("button", { name: "Edit Extra page" })).toBeTruthy();
  });
});

describe("log and edit", () => {
  it("logs a scope change", async () => {
    reply();
    m.mock.onPost(LIST).reply(201, changeRequestResponseFixture({ id: "n" }));
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    fireEvent.click(screen.getByRole("button", { name: /Log scope change/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "New ask" } });
    fireEvent.change(within(dialog).getByLabelText(/Estimated hours/), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log scope change" }));
    await waitFor(() => expect(JSON.parse(m.mock.history.post[0]!.data)).toMatchObject({ projectId: "p1", title: "New ask", estimatedHours: "3.00", estimatedAmount: null }));
  });

  it("edits a pending row, sending only what changed", async () => {
    reply();
    m.mock.onPatch(`${LIST}/a`).reply(200, changeRequestResponseFixture({ id: "a" }));
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    fireEvent.click(screen.getByRole("button", { name: "Edit Extra page" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Extra pages" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save scope change" }));
    await waitFor(() => expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ title: "Extra pages" }));
  });

  it("puts a 422 on the right field", async () => {
    reply();
    m.mock.onPost(LIST).reply(422, { detail: [{ loc: ["body", "title"], msg: "Title is taken", type: "x" }] });
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    fireEvent.click(screen.getByRole("button", { name: /Log scope change/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Dup" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log scope change" }));
    expect(await within(dialog).findByText("Title is taken")).toBeTruthy();
  });
});

describe("decisions", () => {
  it.each([["Approve", "APPROVED"], ["Reject", "REJECTED"], ["Withdraw", "WITHDRAWN"]] as const)("%s sends %s with the note", async (verb, status) => {
    reply();
    m.mock.onPatch(`${LIST}/a`).reply(200, changeRequestResponseFixture({ id: "a", status }));
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    fireEvent.click(within(rowOf("Extra page")).getByRole("button", { name: verb }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Note/), { target: { value: " because " } });
    fireEvent.click(within(dialog).getByRole("button", { name: verb }));
    await waitFor(() => expect(JSON.parse(m.mock.history.patch[0]!.data)).toEqual({ status, decisionNote: "because" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows the server's detail on an invalid transition (409)", async () => {
    reply();
    m.mock.onPatch(`${LIST}/a`).reply(409, { detail: "Change request already decided" });
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Extra page");
    fireEvent.click(within(rowOf("Extra page")).getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(await within(dialog).findByText("Change request already decided")).toBeTruthy();
  });
});

describe("delete", () => {
  it("confirms, then deletes", async () => {
    reply();
    m.mock.onDelete(`${LIST}/b`).reply(204);
    renderWithProviders(<ChangeRequestsPanel project={project} />);
    await screen.findByText("Logo tweak");
    fireEvent.click(screen.getByRole("button", { name: "Delete Logo tweak" }));
    const dialog = await screen.findByRole("dialog");
    expect(m.mock.history.delete).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete scope change" }));
    await waitFor(() => expect(m.mock.history.delete).toHaveLength(1));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});
