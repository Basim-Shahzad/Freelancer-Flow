import { createContext, useContext } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

function getCSRFToken() {
    const name = 'csrf_token=';
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(name)) {
            return trimmed.substring(name.length);
        }
    }
    return null;
}

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = getCSRFToken();
    if (token && (config.method === 'post' || config.method === 'put' || config.method === 'delete')) {
        config.headers['X-CSRFToken'] = token;
    }
    return config;
});

const ApiContext = createContext();

export const useApi = () => {
    const context = useContext(ApiContext)
    if (!context) throw new Error("useApi should be used within ApiProvider")
    return context
}

export const ApiProvider = ({ children }) => {
    const value = { api };
    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
};

export { api };