"use client";

import { useMemo } from "react";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { BusinessForm } from "./business-form";
import { SettingsSkeleton } from "./settings-skeleton";

export function BusinessView() {
  const hydrated = useHydrated();
  const business = useAppStore((s) => s.business);
  const invoices = useAppStore((s) => s.invoices);
  const numbers = useMemo(() => invoices.map((i) => i.number), [invoices]);
  if (!hydrated) return <SettingsSkeleton rows={6} />;
  return <BusinessForm business={business} invoiceNumbers={numbers} />;
}
