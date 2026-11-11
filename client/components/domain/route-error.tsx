"use client";

import { StateBlock } from "@/components/domain/state-block";

interface Props {
  title: string;
  /** Overrides the default reassurance copy. */
  body?: string;
  reset: () => void;
  secondary?: { label: string; href: string };
}

/** Shared body for route `error.tsx` boundaries. Deliberately never logs the error (portal URLs carry tokens). */
export function RouteError({ title, body = "Nothing has changed. Check your connection and try again.", reset, secondary }: Props) {
  return <StateBlock kind="error" title={title} body={body} cta={{ label: "Try again", onClick: reset }} secondary={secondary} />;
}
