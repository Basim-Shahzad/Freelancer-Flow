import type { Metadata, Viewport } from "next";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/newsreader";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "Paylancr", template: "%s · Paylancr" },
  description:
    "From finished work to paid, in one clear thread. Track time, send invoices and share payment instructions. Paylancr never touches your money.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only-focusable fixed start-4 top-4 z-50 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
