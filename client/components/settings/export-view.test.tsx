import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store/auth";
import { mockApi, renderWithProviders } from "@/lib/test";
import { ExportView } from "./export-view";

let m: ReturnType<typeof mockApi>;
beforeEach(() => {
  m = mockApi(); useAppStore.setState({ online: true });
  URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => m.restore());

const open = async (pw?: string) => {
  renderWithProviders(<ExportView />);
  fireEvent.click(screen.getByRole("button", { name: /export my data/i }));
  if (pw !== undefined) fireEvent.change(await screen.findByLabelText("Password"), { target: { value: pw } });
  return screen.findByRole("button", { name: /download export|preparing/i });
};

describe("ExportView", () => {
  it("requires a password", async () => {
    fireEvent.click(await open());
    expect(await screen.findByText("Enter your password to continue.")).toBeInTheDocument();
    expect(m.mock.history.post).toHaveLength(0);
  });

  it("downloads on success and closes", async () => {
    m.mock.onPost("/export").reply(200, new Blob(["zip"]));
    fireEvent.click(await open("pw"));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Password")).toBeNull());
  });

  it("shows a wrong password inline, stays open and signed in", async () => {
    m.mock.onPost("/export").reply(401, { detail: "Incorrect password" });
    fireEvent.click(await open("bad"));
    expect(await screen.findByText(/password isn’t right/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("shows the rate limit message", async () => {
    m.mock.onPost("/export").reply(429, { detail: "slow" });
    fireEvent.click(await open("pw"));
    expect(await screen.findByText(/too many exports/i)).toBeInTheDocument();
  });

  it("shows a pending state", async () => {
    m.mock.onPost("/export").reply(() => new Promise(() => {}));
    fireEvent.click(await open("pw"));
    expect(await screen.findByRole("button", { name: /preparing/i })).toBeDisabled();
  });

  it("disables the button offline", () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<ExportView />);
    expect(screen.getByRole("button", { name: /export my data/i })).toBeDisabled();
  });
});
