import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { testClientItems } from "@/lib/test/clients";
import { projectResponseFixture } from "@/lib/test/projects";
import { ProjectsView } from "./projects-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/projects" }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/clients").reply(200, { clients: testClientItems, total: testClientItems.length });
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

const listCalls = () => m.mock.history.get.filter((r) => r.url === "/projects");
const projects = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => projectResponseFixture({ id: `p${offset + i}`, name: `Project ${offset + i}`, progressPercent: i === 0 ? 60 : null }));

describe("states", () => {
  it("shows a skeleton while loading", () => {
    m.mock.onGet("/projects").reply(() => new Promise(() => {}));
    renderWithProviders(<ProjectsView />);
    expect(screen.getByRole("status", { name: "Loading projects" })).toBeTruthy();
  });

  it("shows the empty state when there are no projects at all", async () => {
    m.mock.onGet("/projects").reply(200, { projects: [], total: 0 });
    renderWithProviders(<ProjectsView />);
    expect(await screen.findByText("No projects yet")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "New project" }).length).toBeGreaterThan(0);
  });

  it("shows an error with retry, and recovers", async () => {
    m.mock.onGet("/projects").replyOnce(500, { detail: "boom" });
    m.mock.onGet("/projects").reply(200, { projects: projects(1), total: 1 });
    renderWithProviders(<ProjectsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Project 0")).toBeTruthy();
  });

  it("shows a rate-limit state on 429", async () => {
    m.mock.onGet("/projects").reply(429, { detail: "Too many" });
    renderWithProviders(<ProjectsView />);
    expect(await screen.findByText("Too many requests")).toBeTruthy();
  });

  it("shows the offline state before the first load", () => {
    useAppStore.setState({ online: false });
    m.mock.onGet("/projects").reply(() => new Promise(() => {}));
    renderWithProviders(<ProjectsView />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });
});

describe("list", () => {
  it("shows each project with its client, billing, status and progress, using a dash for null progress", async () => {
    m.mock.onGet("/projects").reply(200, { projects: projects(2), total: 2 });
    renderWithProviders(<ProjectsView />);
    expect(await screen.findByText("Project 0")).toBeTruthy();
    expect(screen.getAllByText("Harbor Labs").length).toBe(2);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByLabelText("No progress yet").textContent).toBe("—");
  });

  it("searches on the server, debounced", async () => {
    m.mock.onGet("/projects").reply(200, { projects: projects(1), total: 1 });
    renderWithProviders(<ProjectsView />);
    await screen.findByText("Project 0");
    expect(listCalls()[0]!.params).not.toHaveProperty("search");
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "brand" } });
    await waitFor(() => expect(listCalls().at(-1)!.params).toMatchObject({ search: "brand", skip: 0 }));
  });

  it("explains an empty search instead of the empty state", async () => {
    m.mock.onGet("/projects").reply((config) => [200, config.params.search ? { projects: [], total: 0 } : { projects: projects(1), total: 1 }]);
    renderWithProviders(<ProjectsView />);
    await screen.findByText("Project 0");
    fireEvent.change(screen.getByLabelText("Search projects"), { target: { value: "zzz" } });
    expect(await screen.findByText(/No projects match “zzz”/)).toBeTruthy();
    expect(screen.queryByText("No projects yet")).toBeNull();
  });

  it("loads more pages", async () => {
    m.mock.onGet("/projects").reply((config) => [200, { projects: Number(config.params.skip) === 0 ? projects(20) : projects(1, 20), total: 21 }]);
    renderWithProviders(<ProjectsView />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Project 20")).toBeTruthy();
    expect(listCalls()[1]!.params).toMatchObject({ skip: 20 });
  });
});
