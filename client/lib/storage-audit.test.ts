import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/lib/store/auth";

/** Keys the client may write: the time outbox (by design, cleared on sign-out), theme, sidebar collapse, signup country hint. */
const ALLOWED = new Set(["paylancr-time-outbox", "theme", "paylancr-sidebar-collapsed", "paylancr:signup-country"]);
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig-secret";
const EMAIL = "someone@example.com";

afterEach(() => { localStorage.clear(); sessionStorage.clear(); useAuthStore.getState().clear(); });

describe("storage audit", () => {
  it("auth login / refresh / clear never writes the token or user to web storage", () => {
    const s = useAuthStore.getState();
    s.setStatus("loading");
    s.setAccessToken(TOKEN);
    s.setUser({ id: "1", email: EMAIL } as never);
    s.setStatus("authenticated");
    s.setAccessToken(`${TOKEN}-refreshed`);
    for (const store of [localStorage, sessionStorage]) {
      const dump = JSON.stringify({ ...store });
      expect(dump).not.toContain("sig-secret");
      expect(dump).not.toContain(EMAIL);
    }
    s.clear("manual");
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it("only allow-listed keys exist after exercising the outbox", async () => {
    const { useOutbox } = await import("@/lib/time/outbox-store");
    useOutbox.setState({ items: [] });
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) expect(ALLOWED.has(store.key(i)!)).toBe(true);
    }
  });

  it.each(["lib/store/auth.ts", "lib/hooks/portal", "lib/services/portal.service.ts", "lib/portal"])("%s has no web-storage access", (rel) => {
    const root = join(__dirname, "..", rel);
    const files = (() => {
      try { return readdirSync(root).map((f) => join(root, f)); } catch { return [root]; }
    })();
    for (const f of files) {
      let src = "";
      try { src = readFileSync(f, "utf8"); } catch { continue; }
      if (/\.test\./.test(f)) continue;
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code, f).not.toMatch(/\b(localStorage|sessionStorage)\b/);
    }
  });
});
