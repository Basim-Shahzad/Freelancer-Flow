import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { StateBlock } from "@/components/domain/state-block";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-4 py-10">
      <Logo />
      <StateBlock
        kind="empty"
        title="We can’t find that page"
        body="The link may be old or mistyped. Your invoices, clients and time are all still where you left them."
        cta={{ label: "Go to dashboard", href: "/dashboard" }}
        secondary={{ label: "Go home", href: "/" }}
      />
    </main>
  );
}
