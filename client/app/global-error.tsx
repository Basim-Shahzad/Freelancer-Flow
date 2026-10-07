"use client";

/* Plain anchors on purpose: a full page load is the right recovery when the app shell itself crashed. */
/* eslint-disable @next/next/no-html-link-for-pages */

import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/newsreader";
import "./globals.css";
import { useEffect } from "react";
import { ThreadMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary: replaces the root layout, so it renders its own <html>/<body> and
 * avoids anything that needs providers or the router (plain anchors, no next/link).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-4 py-10">
          <a href="/" aria-label="Paylancr home" className="flex items-center gap-3 font-serif text-2xl tracking-[-0.02em] text-foreground no-underline">
            <ThreadMark /><span>Paylancr</span>
          </a>
          <div role="alert" className="flex flex-col items-start gap-4 border-y border-rule py-10">
            <div className="flex max-w-prose flex-col gap-2">
              <h1 className="t-h2">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">Paylancr hit an unexpected problem. Nothing you entered has been lost or changed. Try again, or go back home.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={reset}>Try again</Button>
              <Button asChild variant="outline"><a href="/">Go home</a></Button>
            </div>
          </div>
          {error.digest && <p className="t-caption num">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
