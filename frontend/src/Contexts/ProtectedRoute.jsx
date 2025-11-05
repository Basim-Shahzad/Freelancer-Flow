import { Navigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isLoggedin, isInitialized, loading } = useAuth();

  if (!isInitialized || loading) return null;
  if (!isLoggedin) return <Navigate to="/login" replace />;

  return children;
}