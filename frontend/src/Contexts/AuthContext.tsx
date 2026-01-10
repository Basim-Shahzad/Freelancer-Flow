import React, {
   createContext,
   useContext,
   useState,
   useEffect,
   type ReactNode,
} from "react";
import { AxiosError } from "axios";
import { useApi } from "../hooks/useApi.js";
import type { User } from "@/types/models.js";
import type { AxiosInstance } from "axios";

/* ============================
   Types & Interfaces
============================ */

interface LoginData {
   email: string;
   password: string;
}

interface SignupData extends LoginData {
   username?: string;
}

interface AuthResult {
   success: boolean;
   error?: string;
}

interface AuthContextValue {
   user: User | null;
   loading: boolean;
   isInitialized: boolean;
   isLoggedin: boolean;
   setIsloggedin: React.Dispatch<React.SetStateAction<boolean>>;
   login: (userData: LoginData) => Promise<AuthResult>;
   signup: (userData: SignupData) => Promise<AuthResult>;
   logout: () => Promise<void>;
   fetchCurrentUser: () => Promise<void>;
   error: string;
}

/* ============================
   Context Setup
============================ */

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
   const context = useContext(AuthContext);
   if (!context) {
      throw new Error("useAuth must be used within AuthProvider");
   }
   return context;
};

/* ============================
   Provider Component
============================ */

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   const [error, setError] = useState<string>("");
   const [loading, setLoading] = useState<boolean>(false);
   const [isInitialized, setIsInitialized] = useState<boolean>(false);
   const [isLoggedin, setIsloggedin] = useState<boolean>(false);

   const { api } = useApi() as { api : AxiosInstance };

   useEffect(() => {
      fetchCurrentUser();
   }, []);

   const fetchCurrentUser = async (): Promise<void> => {
      const token = localStorage.getItem("access");

      if (!token) {
         setUser(null);
         setIsloggedin(false);
         setIsInitialized(true);
         return;
      }

      try {
         setLoading(true);
         const res = await api.get<User>("/me/");
         setUser(res.data);
         setIsloggedin(true);
      } catch {
         setUser(null);
         setIsloggedin(false);
         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
      } finally {
         setLoading(false);
         setIsInitialized(true);
      }
   };

   const signup = async (userData: SignupData): Promise<AuthResult> => {
      try {
         setLoading(true);
         setError("");

         await api.post("/register/", userData);

         const loginResult = await login({
            email: userData.email,
            password: userData.password,
         });

         return loginResult;
      } catch (err) {
         const axiosErr = err as AxiosError<any>;
         const errorMsg =
            axiosErr.response?.data?.username?.[0] ||
            axiosErr.response?.data?.email?.[0] ||
            axiosErr.response?.data?.password?.[0] ||
            "Registration failed";

         setError(errorMsg);
         return { success: false, error: errorMsg };
      } finally {
         setLoading(false);
      }
   };

   const login = async (userData: LoginData): Promise<AuthResult> => {
      try {
         setLoading(true);
         setError("");

         const res = await api.post<{
            access: string;
            refresh: string;
         }>("/login/", userData);

         localStorage.setItem("access", res.data.access);
         localStorage.setItem("refresh", res.data.refresh);

         await fetchCurrentUser();
         return { success: true };
      } catch (err) {
         const axiosErr = err as AxiosError<any>;
         const errorMsg =
            axiosErr.response?.data?.detail ||
            axiosErr.response?.data?.email?.[0] ||
            "Login failed";

         setError(errorMsg);
         return { success: false, error: errorMsg };
      } finally {
         setLoading(false);
      }
   };

   const logout = async (): Promise<void> => {
      try {
         setLoading(true);
         setError("");

         const refresh = localStorage.getItem("refresh");
         if (refresh) {
            await api.post("/logout/", { refresh });
         }

         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
         setUser(null);
         setIsloggedin(false);
      } catch (err) {
         const axiosErr = err as AxiosError<any>;
         setError(axiosErr.response?.data?.error || "Logout failed");

         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
         setUser(null);
         setIsloggedin(false);
      } finally {
         setLoading(false);
      }
   };

   const value: AuthContextValue = {
      user,
      loading,
      isInitialized,
      isLoggedin,
      setIsloggedin,
      login,
      signup,
      logout,
      fetchCurrentUser,
      error,
   };

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
