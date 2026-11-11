import { fireEvent, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetPortalTokens } from "@/lib/portal/token";
import { portalApi } from "@/lib/services/portal.service";
import { renderWithProviders } from "@/lib/test";
import { ProjectPortalView } from "./project-view";

let mock: MockAdapter;
beforeEach(() => { resetPortalTokens(); window.history.replaceState(null, "", "/p/p1?token=tok"); mock = new MockAdapter(portalApi, { onNoMatch: "throwException" }); });
afterEach(() => mock.restore());

describe("ProjectPortalView", () => {
  it("renders the summary", async () => {
    mock.onGet("/portal/project/p1").reply(200, { id: "p1", name: "Website", description: "A new site", status: "ACTIVE", dueDate: "2026-06-01T00:00:00Z", currency: "USD" });
    renderWithProviders(<ProjectPortalView id="p1" />);
    expect(await screen.findByRole("heading", { name: "Website" })).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("A new site")).toBeInTheDocument();
  });

  it("shows a not-found state", async () => {
    mock.onGet("/portal/project/p1").reply(404, { detail: "x" });
    renderWithProviders(<ProjectPortalView id="p1" />);
    expect(await screen.findByText(/no longer active/)).toBeInTheDocument();
  });

  it("converts to a user account and shows 422 field errors, then success", async () => {
    mock.onGet("/portal/project/p1").reply(200, { id: "p1", name: "Website", description: null, status: "ACTIVE", dueDate: null, currency: null });
    mock.onPost("/portal/convert").replyOnce(422, { detail: [{ loc: ["body", "password"], msg: "Password too weak", type: "x" }] }).onPost("/portal/convert").reply(200, {});
    renderWithProviders(<ProjectPortalView id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Convert to user account" }));
    fireEvent.change(await screen.findByLabelText("Password"), { target: { value: "weakweak1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Password too weak")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByText(/Your account is ready/)).toBeInTheDocument());
    expect(JSON.parse(mock.history.post[1]!.data)).toEqual({ password: "weakweak1" });
  });

  it("shows a 4xx detail inline", async () => {
    mock.onGet("/portal/project/p1").reply(200, { id: "p1", name: "Website", description: null, status: "ACTIVE", dueDate: null, currency: null });
    mock.onPost("/portal/convert").reply(409, { detail: "Account already exists" });
    renderWithProviders(<ProjectPortalView id="p1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Convert to user account" }));
    fireEvent.change(await screen.findByLabelText("Password"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Account already exists")).toBeInTheDocument();
  });
});
