import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useApi } from "../hooks/useApi.jsx";

const AuthContext = createContext();

export const useAuth = () => {
   const context = useContext(AuthContext);
   if (!context) throw new Error("useAuth must be used within AuthProvider");
   return context;
};

export const AuthProvider = ({ children }) => {
   const [user, setUser] = useState(null);
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);
   const [isInitialized, setIsInitialized] = useState(false);
   const [isLoggedin, setIsloggedin] = useState(false);
   const { api } = useApi();

   useEffect(() => {
      fetchCurrentUser();
   }, []);

   const fetchCurrentUser = async () => {
      const token = localStorage.getItem("access");
      if (!token) {
         setUser(null);
         setIsloggedin(false);
         setIsInitialized(true);
         return;
      }

      try {
         setLoading(true);
         const res = await api.get("/me/");
         setUser(res.data);
         setIsloggedin(true);
      } catch (error) {
         setUser(null);
         setIsloggedin(false);
         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
      } finally {
         setLoading(false);
         setIsInitialized(true);
      }
   };

   const signup = async (userData) => {
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
         const errorMsg =
            err.response?.data?.username?.[0] ||
            err.response?.data?.email?.[0] ||
            err.response?.data?.password?.[0] ||
            "Registration failed";
         setError(errorMsg);
         return { success: false, error: errorMsg };
      } finally {
         setLoading(false);
      }
   };

   const login = async (userData) => {
      try {
         setLoading(true);
         setError("");
         const res = await api.post("/login/", userData);
         localStorage.setItem("access", res.data.access);
         localStorage.setItem("refresh", res.data.refresh);
         await fetchCurrentUser();
         return { success: true };
      } catch (err) {
         const errorMsg = err.response?.data?.detail || err.response?.data?.email?.[0] || "Login failed";
         setError(errorMsg);
         return { success: false, error: errorMsg };
      } finally {
         setLoading(false);
      }
   };

   const logout = async () => {
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
         setError(err.response?.data?.error || "Logout failed");
         localStorage.removeItem("access");
         localStorage.removeItem("refresh");
         setUser(null);
         setIsloggedin(false);
      } finally {
         setLoading(false);
      }
   };

   const value = {
      user,
      loading,
      isInitialized,
      isLoggedin,
      setIsloggedin,
      login,
      signup,
      logout,
      fetchCurrentUser,
      // changePassword,
      error,
   };

   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
