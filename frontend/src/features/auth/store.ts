import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "./types.js";

interface AuthState {
   user: User | null;
   isAuthenticated: boolean;
   isInitialized: boolean;
   setAuth: (user: User | null) => void;
   logout: () => void;
   clearAuth: () => void;
   setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
   persist(
      (set) => ({
         user: null,
         isAuthenticated: !!localStorage.getItem("access"),
         isInitialized: false,

         setAuth: (user) => {
            if (user) {
               set({ user, isAuthenticated: true, isInitialized: true });
            } else {
               set({ user: null, isAuthenticated: false, isInitialized: true });
            }
         },

         logout: () => {
            try {
               localStorage.removeItem("access");
               localStorage.removeItem("refresh");
            } catch (error) {
               console.error("Error clearing localStorage:", error);
            }

            set({ user: null, isAuthenticated: false });
         },

         clearAuth: () => {
            set({ user: null, isAuthenticated: false });
         },

         setInitialized: (initialized) => {
            set({ isInitialized: initialized });
         },
      }),
      {
         name: "auth-storage",
         partialize: (state) => ({
            user: state.user,
         }),
      },
   ),
);
