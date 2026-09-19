import api from "@/services/api.service";
import { MilestoneInList, MilestoneListResponse, MilestoneStatus, milestoneStatuses } from "./types";

export const milestonesApi = {
   getAll: async (filters?: any) => {
      const response = await api.get<MilestoneListResponse>(`/milestones/`, {
         params: filters,
      });
      return response.data;
   },
 
   get: async (milestoneId: string) => {
      const response = await api.get<MilestoneInList>(`/milestones/${milestoneId}`);
      return response.data;
   },
   create: async (milestone: Partial<MilestoneInList>) => {
      const response = await api.post<MilestoneInList>("/milestones", milestone);
      return response.data;
   },

   update: async (milestoneId: string, milestone: Partial<MilestoneInList>) => {
      const response = await api.patch<MilestoneInList>(
         `/milestones/${milestoneId}`,
         milestone,
      );
      return response.data;
   },

   submit: async (milestoneId: string) => {
      const response = await api.post<MilestoneInList>(`/milestones/${milestoneId}/submit`);
      return response.data;
   },

   delete: async (milestoneId: string) => {
      const response = await api.delete(`/milestones/${milestoneId}`);
      return response.data;
   },
};

