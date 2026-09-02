import { create } from "zustand";
import { User } from "./types";

type AuthState = {
   user: User | null;
   accessToken: string | null;
};

type Action = {
   updateUser: (user: User | null) => void;
   setAccessToken: (accessToken: string | null) => void;
   logout: () => void;
};

export const useAuthStore = create<AuthState & Action>()((set) => ({
   user: null,
   accessToken: null,
   updateUser: (user) => set(() => ({ user: user })),
   setAccessToken: (accessToken) => set(() => ({ accessToken: accessToken })),
   logout: () => set(() => ({ user: null, accessToken: null })),
}));
