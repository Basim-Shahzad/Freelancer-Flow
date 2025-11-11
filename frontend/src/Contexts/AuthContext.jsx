import {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
} from "react";
import axios from "axios";
import { useApi } from "./Api";
import { redirect } from "react-router";

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [isInitialized, setIsInitialized] = useState(false)
    const [isLoggedin, setIsloggedin] = useState(false)
    const { api } = useApi()

    // useEffect(() => {
    //     fetchCurrentUser();
    // }, []);  // for now

    const fetchCurrentUser = async () => {
        try {
            setLoading(true);
            const res = await api.get('/me');
            setUser(res.data);
            setIsloggedin(true)
        } catch (error) {
            setUser(null); // Any error = not authenticated or logged out .
            setIsloggedin(false)
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    };

    const registerUser = async (userData) => {
        try {
            setLoading(true);
            setError('');
            const res = await api.post("/register", userData);
            await fetchCurrentUser()
            return { success: true }; // Return success if done
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed');
            setIsloggedin(false)
            return { success: false };
        } finally {
            setLoading(false);
        }
    };

    const login = async (userData) => {
        try {
            setLoading(true);
            setError('');
            const res = await api.post("/login", userData);
            await fetchCurrentUser()
            redirect('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Log in failed');
            setIsloggedin(false)
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            setLoading(true)
            setError('');
            let res = await api.post('/logout')
            setUser(null)
            setIsloggedin(false)
        } catch (err) {
            setError(err.response?.data?.error || 'Logout failed')
        } finally {
            setLoading(false)
        }
    }

    const value = {
        user,
        loading,
        isInitialized,
        isLoggedin,
        setIsloggedin,
        login,
        registerUser,
        logout,
        fetchCurrentUser,
        // changePassword,
        error,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}