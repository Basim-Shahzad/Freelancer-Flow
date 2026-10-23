import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteClientDialog } from "./delete-client-dialog";

const conflict = Object.assign(new Error("conflict"), {
  isAxiosError: true,
  response: { status: 409, data: { detail: "Client has invoices and cannot be deleted" } },
});

const open = () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete client" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete client" }).at(-1)!);
};

describe("DeleteClientDialog", () => {
  it("closes after a successful delete", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DeleteClientDialog name="Harbor Labs" onConfirm={onConfirm} />);
    open();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the server message and keeps the dialog open on 409", async () => {
    const onConfirm = vi.fn().mockRejectedValue(conflict);
    render(<DeleteClientDialog name="Harbor Labs" onConfirm={onConfirm} />);
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be deleted/i);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
