import { fireEvent, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import { renderWithProviders } from "@/lib/test";
import { QueryBoundary } from "./query-boundary";

const base = { data: undefined, isPending: false, isError: false, error: null, isFetching: false, refetch: vi.fn() };
const q = (over: object) => ({ ...base, ...over }) as never;

function httpError(status: number, detail: string) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("x", "E", config, null, { status, statusText: "", headers: {}, config, data: { detail } });
}

beforeEach(() => {
  useAppStore.setState({ online: true });
  base.refetch.mockClear();
});

describe("QueryBoundary", () => {
  it("shows a loading state", () => {
    renderWithProviders(<QueryBoundary query={q({ isPending: true })}>{() => <p>data</p>}</QueryBoundary>);
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("shows the empty state for an empty list", () => {
    renderWithProviders(
      <QueryBoundary query={q({ data: { items: [], total: 0 } })} emptyTitle="No clients">
        {() => <p>data</p>}
      </QueryBoundary>,
    );
    expect(screen.getByText("No clients")).toBeInTheDocument();
    expect(screen.queryByText("data")).not.toBeInTheDocument();
  });

  it("shows the error message with a working retry", () => {
    renderWithProviders(<QueryBoundary query={q({ isError: true, error: httpError(500, "Boom") })}>{() => <p>data</p>}</QueryBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(base.refetch).toHaveBeenCalledOnce();
  });

  it("shows not found for a 404 without retry", () => {
    renderWithProviders(<QueryBoundary query={q({ isError: true, error: httpError(404, "x") })}>{() => <p>data</p>}</QueryBoundary>);
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the offline state when offline and failing", () => {
    useAppStore.setState({ online: false });
    renderWithProviders(<QueryBoundary query={q({ isError: true, error: new Error("net") })}>{() => <p>data</p>}</QueryBoundary>);
    expect(screen.getByText(/you’re offline/i)).toBeInTheDocument();
  });

  it("renders children with the data", () => {
    renderWithProviders(<QueryBoundary query={q({ data: { items: [1], total: 1 } })}>{(d: { items: number[] }) => <p>count {d.items.length}</p>}</QueryBoundary>);
    expect(screen.getByText("count 1")).toBeInTheDocument();
  });
});
