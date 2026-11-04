import { Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthState from "../containers/auth-state";
import AppShell from "../shell/app-shell";
import { ConfirmHost } from "../ui/confirm";
import { SkeletonRows } from "../ui/state";

const MainLayout = () => {
  const auth = useAuth();
  if (auth.error || auth.isLoading)
    return <AuthState error={auth.error} onRetry={() => void auth.retry()} />;
  if (!auth.isAuthenticated) return <Navigate to="/auth/login" replace />;
  return (
    <>
      <AppShell>
        <Suspense fallback={<SkeletonRows label="Loading page" />}>
          <Outlet />
        </Suspense>
      </AppShell>
      <ConfirmHost />
    </>
  );
};

export default MainLayout;
