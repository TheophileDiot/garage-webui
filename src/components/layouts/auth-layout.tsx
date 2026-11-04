import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet } from "react-router-dom";
import AuthState from "../containers/auth-state";

const AuthLayout = () => {
  const auth = useAuth();
  if (auth.error || auth.isLoading)
    return <AuthState error={auth.error} onRetry={() => void auth.retry()} />;
  if (auth.isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
};
export default AuthLayout;
