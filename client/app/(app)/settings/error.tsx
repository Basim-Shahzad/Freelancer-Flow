"use client";

import { RouteError } from "@/components/domain/route-error";

export default function SettingsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError title="Couldn’t load settings" reset={reset} secondary={{ label: "Go to dashboard", href: "/dashboard" }} />;
}
