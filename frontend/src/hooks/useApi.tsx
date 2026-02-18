import { createContext, useContext, type ReactNode } from "react";
import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

const api: AxiosInstance = axios.create({
   baseURL: API_BASE,
   headers: {
      "Content-Type": "application/json",
   },
   withCredentials: true,
});

let isRefreshing = false;
let failedQueue: {
   resolve: (value?: unknown) => void;
   reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: unknown) => {
   failedQueue.forEach(({ resolve, reject }) => {
      if (error) reject(error);
      else resolve();
   });
   failedQueue = [];
};

api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
         _retry?: boolean;
      };

      if (error.response?.status !== 401 || originalRequest._retry) {
         return Promise.reject(error);
      }

      if (isRefreshing) {
         return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
         })
            .then(() => api(originalRequest))
            .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
         await axios.post(`${API_BASE}/auth/token/refresh/`, {}, { withCredentials: true });
         processQueue(null);
         return api(originalRequest);
      } catch (refreshError) {
         processQueue(refreshError);
         window.location.href = "/login";
         return Promise.reject(refreshError);
      } finally {
         isRefreshing = false;
      }
   },
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
