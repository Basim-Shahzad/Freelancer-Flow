import { api } from "@/hooks/useApi.js";
import type { User, AuthResponse, SignupData, LoginCredentials } from "./types.js";

export const authApi = {
   login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
      try {
         if (!credentials.email || !credentials.password) {
            throw new Error("Email and password are required");
         }

         const { data } = await api.post<AuthResponse>("/login/", credentials);
         
         if (!data.access || !data.refresh) {
            throw new Error("Invalid response from server");
         }
         
         return data;
      } catch (error: any) {
         console.error("Login API error:", error);
         throw error;
      }
   },

   signup: async (signupData: SignupData): Promise<AuthResponse> => {
      try {
         if (!signupData.email || !signupData.password) {
            throw new Error("Email and password are required");
         }

         await api.post("/register/", signupData);
         
         return authApi.login({
            email: signupData.email,
            password: signupData.password,
         });
      } catch (error: any) {
         console.error("Signup API error:", error);
         
         if (error?.response?.status === 400) {
            throw error;
         }
         
         if (error.message === "Network Error") {
            throw new Error("Cannot connect to server. Please check your connection.");
         }
         
         throw error;
      }
   },

   logout: async (refreshToken: string): Promise<void> => {
      try {
         if (!refreshToken) {
            console.warn("No refresh token provided for logout");
            return;
         }
         
         await api.post("/logout/", { refresh: refreshToken });
      } catch (error: any) {
         console.error("Logout API error:", error);
         throw error;
      }
   },

   getCurrentUser: async (): Promise<User> => {
      try {
         const token = localStorage.getItem("access");
         
         if (!token) {
            throw new Error("No authentication token found");
         }
         
         const { data } = await api.get<User>("/me/");
         
         if (!data || !data.id) {
            throw new Error("Invalid user data received");
         }
         
         return data;
      } catch (error: any) {
         console.error("Get current user API error:", error);
         
         if (error?.response?.status === 401) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            throw new Error("Session expired. Please log in again.");
         }
         
         throw error;
      }
   },

   refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
      try {
         if (!refreshToken) {
            throw new Error("No refresh token available");
         }
         
         const { data } = await api.post<AuthResponse>("/token/refresh/", {
            refresh: refreshToken,
         });
         
         if (!data.access) {
            throw new Error("Invalid refresh response");
         }
         
         return data;
      } catch (error: any) {
         console.error("Token refresh error:", error);
         
         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
         
         throw new Error("Session expired. Please log in again.");
      }
   },
};