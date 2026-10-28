import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store";
import { mockApi, profileFixture, renderWithProviders } from "@/lib/test";
import { changeRequestResponseFixture } from "@/lib/test/change-requests";
import { projectResponseFixture } from "@/lib/test/projects";
import { PendingScopeChanges } from "./pending-scope-changes";

const LIST = "/change-requests";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi();
  useAppStore.setState({ online: true });
  m.mock.onGet("/profile").reply(200, profileFixture());
  m.mock.onGet("/projects").reply(200, { projects: [projectResponseFixture({ id: "p1", name: "Mobile app" })], total: 1 });
});
afterEach(() => {
  m.restore();
  useAppStore.setState({ online: true });
});

describe("PendingScopeChanges", () => {
  it("renders nothing when no scope change is pending", async () => {
    m.mock.onGet(LIST).reply(200, { changeRequests: [], total: 0 });
    const { container } = renderWithProviders(<PendingScopeChanges />);
    await waitFor(() => expect(m.mock.history.get.some((r) => r.url === LIST)).toBe(true));
    expect(container.textContent).toBe("");
  });

  it("lists pending rows with project, amount and a link to the project", async () => {
    m.mock.onGet(LIST).reply(200, { changeRequests: [changeRequestResponseFixture({ title: "Extra page", estimatedAmount: "600.00" })], total: 1 });
    renderWithProviders(<PendingScopeChanges />);
    expect(await screen.findByText("Extra page")).toBeTruthy();
    expect(await screen.findByText("Mobile app")).toBeTruthy();
    expect(m.mock.history.get.find((r) => r.url === LIST)?.params).toEqual({ status: "PENDING", limit: 100 });
    expect(screen.getByRole("link").getAttribute("href")).toBe("/projects/p1");
  });

  it("degrades to a notice on error", async () => {
    m.mock.onGet(LIST).reply(500, { detail: "boom" });
    renderWithProviders(<PendingScopeChanges />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });
});
