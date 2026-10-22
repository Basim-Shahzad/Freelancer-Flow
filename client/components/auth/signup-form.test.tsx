import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { mockApi, profileFixture, renderWithProviders, testUser } from "@/lib/test";
import { router } from "@/lib/test/navigation";
import { SignUpForm } from "./signup-form";

vi.mock("next/navigation", () => import("@/lib/test/navigation"));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  vi.clearAllMocks();
  m = mockApi();
  useAppStore.setState({ online: true, hydrated: true });
  m.mock.onGet("/profile").reply(200, profileFixture({ businessName: null }));
  window.history.replaceState(null, "", "/signup");
});
afterEach(() => m.restore());

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => {
  fill("Full name", "Ayesha Malik");
  fill("Email", "ayesha@example.com");
  fill("Password", "a-long-passphrase");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
};

describe("SignUpForm", () => {
  it("registers, signs in and goes to /onboarding", async () => {
    m.mock.onPost("/auth/register").reply(201, {});
    m.mock.onPost("/auth/login").reply(200, { accessToken: "t" });
    m.mock.onGet("/auth/me").reply(200, testUser);
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/onboarding"));
    expect(JSON.parse(m.mock.history.post[0]!.data)).toMatchObject({ fullName: "Ayesha Malik", email: "ayesha@example.com" });
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("carries a safe ?next= through to onboarding", async () => {
    m.mock.onPost("/auth/register").reply(201, {});
    m.mock.onPost("/auth/login").reply(200, { accessToken: "t" });
    m.mock.onGet("/auth/me").reply(200, testUser);
    window.history.replaceState(null, "", "/signup?next=%2Fprojects");
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    submit();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/onboarding?next=%2Fprojects"));
  });

  it("shows an email error and a login link on a 409", async () => {
    m.mock.onPost("/auth/register").reply(409, { detail: "exists" });
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    submit();
    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in instead" })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows the server message for other errors", async () => {
    m.mock.onPost("/auth/register").networkError();
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    submit();
    expect(await screen.findByText(/can’t reach the server/i)).toBeInTheDocument();
  });

  it("validates locally without calling the API", async () => {
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Accept the Terms and Privacy Policy to continue.")).toBeInTheDocument();
    expect(m.mock.history.post).toHaveLength(0);
  });

  it("disables submit when offline", () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<SignUpForm />, { auth: "unauthenticated" });
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });
});
