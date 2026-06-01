import { create } from "zustand";

interface ClientsState {}

export const useClientsStore = create<ClientsState>()((set) => ({}));
