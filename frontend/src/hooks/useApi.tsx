import { createContext, useContext, type ReactNode } from "react";
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = "http://localhost:8000/api";

const api: AxiosInstance = axios.create({
   baseURL: API_BASE,
   headers: {
      "Content-Type": "application/json",
   },
   withCredentials: true,
});

api.interceptors.request.use(
   (config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem("access");
      if (token) {
         config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
   },
   (error) => Promise.reject(error)
);

api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry) {
         originalRequest._retry = true;

         const refreshToken = localStorage.getItem("refresh");
         if (!refreshToken) {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            window.location.href = "/login";
            return Promise.reject(error);
         }

         try {
            const res = await axios.post<{ access: string }>(`${API_BASE}/token/refresh/`, { refresh: refreshToken });

            const { access } = res.data;
            localStorage.setItem("access", access);
            originalRequest.headers.Authorization = `Bearer ${access}`;

            return api(originalRequest);
         } catch {
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            window.location.href = "/login";
            return Promise.reject(error);
         }
      }

      return Promise.reject(error);
   }
);

type ApiContextType = {
   api: AxiosInstance;
};

const ApiContext = createContext<ApiContextType | null>(null);

export const useApi = (): ApiContextType => {
   const ctx = useContext(ApiContext);
   if (!ctx) throw new Error("useApi must be used within ApiProvider");
   return ctx;
};

export const ApiProvider = ({ children }: { children: ReactNode }) => {
   return <ApiContext.Provider value={{ api }}>{children}</ApiContext.Provider>;
};

export { api };
