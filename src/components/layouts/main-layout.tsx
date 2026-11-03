import { PageContext } from "@/context/page-context-value";
import { Suspense, useContext, useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../containers/sidebar";
import { ArrowLeft, MenuIcon } from "lucide-react";
import Button from "../ui/button";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useAuth } from "@/hooks/useAuth";
import AuthState from "../containers/auth-state";
import { SkeletonRows } from "../ui/state";
import { ConfirmHost } from "../ui/confirm";

const MainLayout = () => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { pathname } = useLocation();
  const auth = useAuth();
  useEffect(() => onClose(), [pathname, onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);
  if (auth.error || auth.isLoading)
    return <AuthState error={auth.error} onRetry={() => void auth.retry()} />;
  if (!auth.isAuthenticated) return <Navigate to="/auth/login" replace />;
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="drawer md:drawer-open h-dvh">
        <input
          type="checkbox"
          className="drawer-toggle"
          checked={isOpen}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
        <div className="drawer-content flex flex-col min-w-0 overflow-hidden">
          <Header onSidebarOpen={() => onOpen()} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 min-w-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8 focus:outline-none"
          >
            <Suspense fallback={<SkeletonRows label="Loading page" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <div className="drawer-side z-40">
          <div aria-hidden className="drawer-overlay" onClick={onClose} />
          <Sidebar />
        </div>
      </div>
      <ConfirmHost />
    </>
  );
};

const Header = ({ onSidebarOpen }: { onSidebarOpen: () => void }) => {
  const page = useContext(PageContext);
  const navigate = useNavigate();
  return (
    <header className="shrink-0 border-b border-base-300 px-4 md:px-8">
      <div className="container flex h-16 items-center gap-3 md:h-20">
        {page?.prev ? (
          <Button
            onClick={() => navigate(page.prev!, { replace: true })}
            color="ghost"
            icon={ArrowLeft}
            aria-label="Back to list"
          />
        ) : (
          <Button
            icon={MenuIcon}
            color="ghost"
            className="md:hidden"
            onClick={onSidebarOpen}
            aria-label="Open navigation"
          />
        )}
        <h1 className="page-title min-w-0 flex-1 truncate">
          {page?.title || "Overview"}
        </h1>
        {page?.actions}
      </div>
    </header>
  );
};
export default MainLayout;
