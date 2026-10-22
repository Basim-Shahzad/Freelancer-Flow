"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { isProfileComplete, profileToBusiness, splitBusinessPatch } from "@/lib/api/mappers/profile";
import type { ProfileResponse, ProfileUpdate } from "@/lib/api/profile.types";
import { profileService } from "@/lib/services/profile.service";
import { useAppStore } from "@/lib/store";
import type { BusinessProfile } from "@/lib/types";
import { useSession } from "@/lib/hooks/auth/use-auth";

export const profileKeys = { all: ["profile"] as const, detail: ["profile", "detail"] as const };

/** The signed-in freelancer's business profile. Only fetched once the session is authenticated. */
export function useProfile() {
  const { isAuthenticated } = useSession();
  return useQuery({
    queryKey: profileKeys.detail,
    queryFn: profileService.get,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

/**
 * The `BusinessProfile` view model (API profile + account user + local-only fields). Always returns a value:
 * while the profile loads the text fields are empty and the currency is USD, so use `useProfile()` /
 * `<QueryBoundary>` on screens that must show a loading or error state.
 */
export function useBusiness(): BusinessProfile {
  const { data } = useProfile();
  const { user } = useSession();
  const local = useAppStore((s) => s.businessLocal);
  return useMemo(() => profileToBusiness(data, user, local), [data, user, local]);
}

/** Derived "onboarded" flag: the profile has a business name. `ready` is false until the profile has loaded. */
export function useOnboarded(): { ready: boolean; onboarded: boolean } {
  const { data, isSuccess } = useProfile();
  return { ready: isSuccess, onboarded: isProfileComplete(data) };
}

/** PATCH /profile with an optimistic cache update, rolled back if the request fails. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => profileService.patch(update),
    onMutate: async (update) => {
      await qc.cancelQueries({ queryKey: profileKeys.detail });
      const previous = qc.getQueryData<ProfileResponse>(profileKeys.detail);
      if (previous) qc.setQueryData<ProfileResponse>(profileKeys.detail, { ...previous, ...(update as Partial<ProfileResponse>) });
      return { previous };
    },
    onError: (_err, _update, ctx) => {
      if (ctx?.previous) qc.setQueryData(profileKeys.detail, ctx.previous);
    },
    onSuccess: (profile) => qc.setQueryData(profileKeys.detail, profile),
  });
}

/**
 * Saves a UI-level business patch: API fields go to PATCH /profile, local-only fields to the store.
 * Local fields are written only after the API accepted the rest.
 */
export function useSaveBusiness() {
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const updateLocal = useAppStore((s) => s.updateBusinessLocal);
  const save = async (patch: Partial<BusinessProfile>) => {
    const profile = qc.getQueryData<ProfileResponse>(profileKeys.detail);
    const { defaultCurrency } = profileToBusiness(profile, null, useAppStore.getState().businessLocal);
    const { remote, local } = splitBusinessPatch(patch, defaultCurrency);
    if (Object.keys(remote).length) await update.mutateAsync(remote);
    if (Object.keys(local).length) updateLocal(local);
  };
  return { save, isPending: update.isPending };
}
