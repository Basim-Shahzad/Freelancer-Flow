import { milestonesApi } from "./api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MilestoneInList, MilestoneListResponse } from "./types";
import { AxiosError } from "axios";

export function useMilestones() {
   return useQuery<MilestoneListResponse, AxiosError<ApiError>>({
      queryKey: ["milestones"],
      queryFn: () => milestonesApi.getAll(),
   });
}

export function useCreateMilestone() {
   return useMutation<
      MilestoneInList,
      AxiosError<ApiValidationError>,
      Partial<MilestoneInList>
   >({
      mutationFn: (milestoneData: Partial<MilestoneInList>) =>
         milestonesApi.create(milestoneData),
   });
}

export function useMilestone(id: string) {
   return useQuery<MilestoneInList, AxiosError<ApiError>>({
      queryKey: ["milestone", id],
      queryFn: () => milestonesApi.get(id),
   });
}

export function useUpdateMilestone(id: string) {
   return useMutation<
      MilestoneInList,
      AxiosError<ApiValidationError>,
      Partial<MilestoneInList>
   >({
      mutationFn: (milestoneData: Partial<MilestoneInList>) =>
         milestonesApi.update(id, milestoneData),
   });
}

export function useSubmitMilestone(milestoneId: string) {
   return useMutation<MilestoneInList, AxiosError<ApiValidationError>>({
      mutationFn: () => milestonesApi.submit(milestoneId),
   });
}

export function useDeleteMilestone(milestoneId: string) {
   return useMutation<void, AxiosError<ApiValidationError>>({
      mutationFn: () => milestonesApi.delete(milestoneId),
   });
}
