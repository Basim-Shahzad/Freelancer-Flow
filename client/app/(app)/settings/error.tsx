"use client";

import { useEffect } from "react";
import { StateBlock } from "@/components/domain/state-block";

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <StateBlock
      kind="error"
      title="Couldn’t load settings"
      body="Nothing has changed. Check your connection and try again."
      cta={{ label: "Try again", onClick: reset }}
      secondary={{ label: "Go to dashboard", href: "/dashboard" }}
    />
  );
}
