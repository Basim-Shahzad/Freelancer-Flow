import type { ProfileResponse, ProfileUpdate } from "@/lib/api/profile.types";
import { api } from "./api.service";

export const profileService = {
  get: () => api.get<ProfileResponse>("/profile").then((r) => r.data),
  patch: (update: ProfileUpdate) => api.patch<ProfileResponse>("/profile", update).then((r) => r.data),
};
