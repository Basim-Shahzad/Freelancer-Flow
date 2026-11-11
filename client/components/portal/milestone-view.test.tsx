import { fireEvent, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetPortalTokens } from "@/lib/portal/token";
import { portalApi } from "@/lib/services/portal.service";
import { useAppStore } from "@/lib/store";
import { renderWithProviders } from "@/lib/test";
import { milestoneResponseFixture } from "@/lib/test/projects";
import { MilestonePortalView } from "./milestone-view";

let mock: MockAdapter;
beforeEach(() => { resetPortalTokens(); window.history.replaceState(null, "", "/m/m1?token=tok"); mock = new MockAdapter(portalApi, { onNoMatch: "throwException" }); });
afterEach(() => { mock.restore(); useAppStore.setState({ online: true }); });

const submitted = (o = {}) => milestoneResponseFixture({ id: "m1", name: "Design", status: "SUBMITTED", approvalRequired: true, ...o });

describe("MilestonePortalView", () => {
  it("approves with confirm and an optional comment", async () => {
    mock.onGet("/portal/milestone/m1").reply(200, submitted());
    mock.onPost("/portal/milestone/m1/approve").reply(200, submitted({ status: "APPROVED" }));
    renderWithProviders(<MilestonePortalView id="m1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve milestone" }));
    fireEvent.change(await screen.findByLabelText(/Comment/), { target: { value: "Looks great" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm approval" }));
    expect(await screen.findByText(/you approved this milestone/)).toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({ comment: "Looks great" });
    expect(mock.history.get).toHaveLength(1);
  });

  it("rejects without a comment", async () => {
    mock.onGet("/portal/milestone/m1").reply(200, submitted());
    mock.onPost("/portal/milestone/m1/reject").reply(200, submitted({ status: "REJECTED" }));
    renderWithProviders(<MilestonePortalView id="m1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Request changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/asked for changes/)).toBeInTheDocument();
    expect(JSON.parse(mock.history.post[0]!.data)).toEqual({});
  });

  it("shows the 400 detail when the milestone can’t be decided", async () => {
    mock.onGet("/portal/milestone/m1").reply(200, submitted());
    mock.onPost("/portal/milestone/m1/approve").reply(400, { detail: "Milestone is not awaiting approval" });
    renderWithProviders(<MilestonePortalView id="m1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve milestone" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm approval" }));
    expect(await screen.findByText("Milestone is not awaiting approval")).toBeInTheDocument();
  });

  it("offers no decision on an approved milestone", async () => {
    mock.onGet("/portal/milestone/m1").reply(200, submitted({ status: "APPROVED", approvedAt: "2026-04-01T00:00:00Z" }));
    renderWithProviders(<MilestonePortalView id="m1" />);
    await screen.findByText("Design");
    expect(screen.queryByRole("button", { name: "Approve milestone" })).not.toBeInTheDocument();
  });

  it("disables deciding while offline and handles expired links", async () => {
    useAppStore.setState({ online: false });
    mock.onGet("/portal/milestone/m1").reply(200, submitted());
    const { unmount } = renderWithProviders(<MilestonePortalView id="m1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve milestone" })).toBeDisabled());
    unmount();
    mock.reset(); resetPortalTokens(); window.history.replaceState(null, "", "/m/m1?token=tok");
    mock.onGet("/portal/milestone/m1").reply(401, { detail: "x" });
    renderWithProviders(<MilestonePortalView id="m1" />);
    expect(await screen.findByText(/expired or isn’t valid/)).toBeInTheDocument();
  });
});
