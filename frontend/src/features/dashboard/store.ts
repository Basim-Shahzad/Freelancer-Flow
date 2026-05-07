import { create } from "zustand";

export type timeRangeType = "yearly" | "monthly" | "weekly" | "all"

interface DashboardUIState {
   timeRange: timeRangeType;
   setTimeRange: (timeRange: timeRangeType) => void;
}

export const useDashboardStore = create<DashboardUIState>((set) => ({
   timeRange: "monthly",
   setTimeRange: (timeRange) => set({ timeRange }),
}));
