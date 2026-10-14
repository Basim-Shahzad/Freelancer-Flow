import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { mockApi, renderWithProviders } from "@/lib/test";
import { router } from "@/lib/test/navigation";
import { AccountView } from "./account-view";

vi.mock("next/navigation", () => import("@/lib/test/navigation"));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  vi.clearAllMocks();
  m = mockApi();
  useAppStore.setState({ online: true });
});
afterEach(() => m.restore());

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Change password" }));
const fillValid = () => {
  fill("Current password", "old-password");
  fill("New password", "brand-new-pass");
  fill("Confirm new password", "brand-new-pass");
};

describe("change password", () => {
  it("shows the signed-in email", () => {
    renderWithProviders(<AccountView />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("validates locally without calling the API", async () => {
    renderWithProviders(<AccountView />);
    fill("Current password", "x");
    fill("New password", "short");
    fill("Confirm new password", "other");
    submit();
    expect(await screen.findByText("Use 8 characters or more.")).toBeInTheDocument();
    expect(screen.getByText("The passwords don’t match.")).toBeInTheDocument();
    expect(m.mock.history.post).toHaveLength(0);
  });

  it("changes the password, signs out and routes to /login", async () => {
    m.mock.onPost("/auth/change-password").reply(200, { message: "ok" });
    renderWithProviders(<AccountView />);
    fillValid();
    submit();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(JSON.parse(m.mock.history.post[0]!.data)).toEqual({ currentPassword: "old-password", newPassword: "brand-new-pass" });
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(toast.success).toHaveBeenCalled();
  });

  it.each([400, 401])("shows a field error on a %i (wrong current password) and stays signed in", async (status) => {
    m.mock.onPost("/auth/change-password").reply(status, { detail: "Incorrect password" });
    renderWithProviders(<AccountView />);
    fillValid();
    submit();
    expect(await screen.findByText("That isn’t your current password.")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(m.refresh.history.post).toHaveLength(0);
  });

  it("maps a 422 onto the new password field", async () => {
    m.mock.onPost("/auth/change-password").reply(422, { detail: [{ loc: ["body", "newPassword"], msg: "Too weak", type: "x" }] });
    renderWithProviders(<AccountView />);
    fillValid();
    submit();
    expect(await screen.findByText("Too weak")).toBeInTheDocument();
  });

  it("shows a server error on a network failure", async () => {
    m.mock.onPost("/auth/change-password").networkError();
    renderWithProviders(<AccountView />);
    fillValid();
    submit();
    expect(await screen.findByText(/can’t reach the server/i)).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("disables submit and explains when offline", () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<AccountView />);
    expect(screen.getByRole("button", { name: "Change password" })).toBeDisabled();
    expect(screen.getByText(/you’re offline/i)).toBeInTheDocument();
  });
});

describe("log out of all devices", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: /log out everywhere/i }));
  const confirm = () => fireEvent.click(within_dialog());
  const within_dialog = () => screen.getAllByRole("button", { name: /log out everywhere/i }).at(-1)!;

  it("confirms, calls the API, signs out and routes to /login", async () => {
    m.mock.onPost("/auth/logout-all").reply(200, { message: "ok" });
    renderWithProviders(<AccountView />);
    open();
    expect(await screen.findByText("Log out of all devices?")).toBeInTheDocument();
    confirm();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(m.mock.history.post).toHaveLength(1);
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("still signs out this device if the server call fails", async () => {
    m.mock.onPost("/auth/logout-all").networkError();
    renderWithProviders(<AccountView />);
    open();
    await screen.findByText("Log out of all devices?");
    confirm();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(useAuthStore.getState().status).toBe("unauthenticated");
    expect(toast.error).toHaveBeenCalled();
  });
});
