"use client";

import { useMemo } from "react";
import { QueryBoundary } from "@/components/domain/query-boundary";
import { useBusiness, useProfile } from "@/lib/hooks/profile";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useAppStore } from "@/lib/store";
import { BusinessForm } from "./business-form";
import { SettingsSkeleton } from "./settings-skeleton";

export function BusinessView() {
  const hydrated = useHydrated(); // invoice numbers still come from the mock store
  const profile = useProfile();
  const business = useBusiness();
  const invoices = useAppStore((s) => s.invoices);
  const numbers = useMemo(() => invoices.map((i) => i.number), [invoices]);
  if (!hydrated) return <SettingsSkeleton rows={6} />;
  return (
    <QueryBoundary query={profile} loading={<SettingsSkeleton rows={6} />} isEmpty={() => false}>
      {() => <BusinessForm business={business} invoiceNumbers={numbers} />}
    </QueryBoundary>
  );
}
