import { createContext, useContext } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

const api = axios.create({
   baseURL: API_BASE,
   headers: {
      "Content-Type": "application/json",
   },
   withCredentials: true,
});

api.interceptors.request.use(
   (config) => {
      const token = localStorage.getItem("access");
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
   },
   (error) => {
      return Promise.reject(error);
   }
);

api.interceptors.response.use(
   (response) => response,
   async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
         originalRequest._retry = true;

         try {
            const refreshToken = localStorage.getItem("refresh");
            if (refreshToken) {
               const response = await axios.post(`${API_BASE}/token/refresh/`, {
                  refresh: refreshToken,
               });

               const { access } = response.data;
               localStorage.setItem("access", access);

               originalRequest.headers["Authorization"] = `Bearer ${access}`;
               return api(originalRequest);
            }
         } catch (refreshError) {
            localStorage.removeItem("access"); // Changed keys
            localStorage.removeItem("refresh");
            window.location.href = "/login";
            return Promise.reject(refreshError);
         }
      }
      return Promise.reject(error);
   }
);

const ApiContext = createContext();

export const useApi = () => {
   const context = useContext(ApiContext);
   if (!context) throw new Error("useApi must be used within ApiProvider");
   return context;
};

export const ApiProvider = ({ children }) => {
   const value = { api };
   return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};

export { api };
