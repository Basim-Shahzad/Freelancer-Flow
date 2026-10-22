import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { mockApi, profileFixture, renderWithProviders, testUser } from "@/lib/test";
import { router } from "@/lib/test/navigation";
import { LogInForm } from "./login-form";

vi.mock("next/navigation", () => import("@/lib/test/navigation"));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  vi.clearAllMocks();
  m = mockApi();
  useAppStore.setState({ online: true, hydrated: true });
  m.mock.onGet("/profile").reply(200, profileFixture({ businessName: null }));
  window.history.replaceState(null, "", "/login");
});
afterEach(() => m.restore());

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => {
  fill("Email", "test@example.com");
  fill("Password", "pw-123456");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
};

describe("LogInForm", () => {
  it("logs in, loads the user and goes to the dashboard", async () => {
    m.mock.onPost("/auth/login").reply(200, { accessToken: "t" });
    m.mock.onGet("/auth/me").reply(200, testUser);
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
    expect(useAuthStore.getState().status).toBe("authenticated");
    expect(toast.success).toHaveBeenCalled();
  });

  it("honours a safe ?next= and ignores an unsafe one", async () => {
    m.mock.onPost("/auth/login").reply(200, { accessToken: "t" });
    m.mock.onGet("/auth/me").reply(200, testUser);
    window.history.replaceState(null, "", "/login?next=%2Fprojects%3Ftab%3Dtime");
    const { unmount } = renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/projects?tab=time"));
    unmount();

    router.push.mockClear();
    window.history.replaceState(null, "", "/login?next=%2F%2Fevil.com");
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard"));
  });

  it.each([400, 401])("shows the 'don't match' notice on a %i", async (status) => {
    m.mock.onPost("/auth/login").reply(status, { detail: "Incorrect email or password" });
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    submit();
    expect(await screen.findByText(/don’t match/i)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("shows the server message for other errors", async () => {
    m.mock.onPost("/auth/login").networkError();
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    submit();
    expect(await screen.findByText(/can’t reach the server/i)).toBeInTheDocument();
  });

  it("validates locally without calling the API", async () => {
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(m.mock.history.post).toHaveLength(0);
  });

  it("disables submit and explains when offline", () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<LogInForm />, { auth: "unauthenticated" });
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    expect(screen.getByText(/you’re offline/i)).toBeInTheDocument();
  });

  it("bounces an already signed-in, onboarded user to next (useSignedInRedirect)", async () => {
    m.mock.onGet("/profile").reply(200, profileFixture());
    window.history.replaceState(null, "", "/login?next=%2Finvoices");
    renderWithProviders(<LogInForm />, { auth: "authenticated" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/invoices"));
  });

  it("does not bounce a signed-in user who is not onboarded", () => {
    renderWithProviders(<LogInForm />, { auth: "authenticated" });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
