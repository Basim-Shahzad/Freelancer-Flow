import { create } from "zustand";

interface ProjectsState {}

export const useProjectsStore = create<ProjectsState>()((set) => ({}));
