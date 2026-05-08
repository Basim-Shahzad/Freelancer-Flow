import axios, { create, type AxiosInstance } from "axios";
import { useAuthStore } from "@/stores/useAuthStore";
import { Tokens } from "@/types/auth.types";

const API_BASE = "http://localhost:8000/api";

const api: AxiosInstance = axios.create({
   baseURL: API_BASE,
   headers: { "Content-Type": "application/json" },
   withCredentials: true,
});

api.interceptors.request.use((config) => {
   const accessToken = useAuthStore.getState().accessToken;
   if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
   }
   return config;
});

api.interceptors.response.use(
   (response) => response,
   async (error) => {
      if (error.response?.status === 401) {
         const { data } = await axios.post<Tokens>(`${API_BASE}/auth/token/refresh/`, {}, { withCredentials: true });
         useAuthStore.getState().setAccessToken(data.access);
         return axios(error.config);
      }
      return Promise.reject(error);
   },
);

export default api;