"use client";

import { QueryBoundary } from "@/components/domain/query-boundary";
import { useBusiness, useProfile } from "@/lib/hooks/profile";
import { BusinessForm } from "./business-form";
import { SettingsSkeleton } from "./settings-skeleton";

export function BusinessView() {
  const profile = useProfile();
  const business = useBusiness();
  return (
    <QueryBoundary query={profile} loading={<SettingsSkeleton rows={6} />} isEmpty={() => false}>
      {() => <BusinessForm business={business} />}
    </QueryBoundary>
  );
}
