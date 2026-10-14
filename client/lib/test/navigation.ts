import { vi } from "vitest";

/**
 * Shared `next/navigation` mock. In a test file:
 *   vi.mock("next/navigation", () => import("@/lib/test/navigation"));
 * then assert on `router.replace` / `router.push`.
 */
export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams(window.location.search);
