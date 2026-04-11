import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/features/auth/store.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

const api: AxiosInstance = axios.create({
   baseURL: API_BASE,
   headers: { "Content-Type": "application/json" },
   withCredentials: true,
});

let isRefreshing = false;
let failedQueue: {
   resolve: (value?: unknown) => void;
   reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: unknown) => {
   failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
   failedQueue = [];
};

// Request interceptor — attach access token
api.interceptors.request.use((config) => {
   const token = useAuthStore.getState().accessToken;
   if (token) config.headers.Authorization = `Bearer ${token}`;
   return config;
});

// Response interceptor — handle 401s and token refresh
api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
         _retry?: boolean;
         _skipRefresh?: boolean;
      };

      if (error.response?.status !== 401 || originalRequest._retry || originalRequest._skipRefresh) {
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
         const { data } = await axios.post(`${API_BASE}/auth/token/refresh/`, {}, { withCredentials: true });
         useAuthStore.getState().setAccessToken(data.access);

         processQueue(null);
         return api(originalRequest);
      } catch (refreshError) {
         processQueue(refreshError);
         useAuthStore.getState().logout();
         window.location.href = "/login";
         return Promise.reject(refreshError);
      } finally {
         isRefreshing = false;
      }
   },
);

export { api };
