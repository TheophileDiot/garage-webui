import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  HardDrive,
  KeySquare,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Button from "../ui/button";
import appStore from "@/stores/app-store";
import garageLogo from "@/assets/garage-logo.svg";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { url } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "zustand";
import { useNodesHealth } from "@/pages/home/hooks";
import { StatusPill } from "../ui/status";

const pages = [
  { icon: LayoutDashboard, title: "Overview", path: "/", exact: true },
  { icon: HardDrive, title: "Cluster", path: "/cluster" },
  { icon: ArchiveIcon, title: "Buckets", path: "/buckets" },
  { icon: KeySquare, title: "Access keys", path: "/keys" },
];

const QuorumChip = () => {
  const { data, isError, isPending } = useNodesHealth();
  const tone = isError
    ? "bad"
    : isPending
      ? "idle"
      : data?.status === "healthy"
        ? "ok"
        : "warn";
  const label = isError
    ? "Status unavailable"
    : isPending
      ? "Checking cluster"
      : data?.status === "healthy"
        ? "Quorum healthy"
        : data?.status === "unavailable"
          ? "Quorum lost"
          : "Quorum degraded";
  return (
    <Link
      to="/cluster"
      className="row-hover block rounded-lg border border-base-300 bg-base-100 px-3 py-2.5"
    >
      <StatusPill tone={tone}>{label}</StatusPill>
      {data ? (
        <p className="num mt-1 text-xs text-base-content/70">
          {data.partitionsQuorum}/{data.partitions} partitions ·{" "}
          {data.connectedNodes}/{data.knownNodes} nodes
        </p>
      ) : null}
    </Link>
  );
};

const Sidebar = () => {
  const { pathname } = useLocation();
  const auth = useAuth();
  const theme = useStore(appStore, (state) => state.theme);
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      window.location.href = url("/auth/login");
    },
    onError: (error) => toast.error(error.message || "Could not sign out"),
  });
  return (
    <aside className="flex h-full w-64 max-w-[85vw] flex-col border-r border-base-300 bg-base-200">
      <Link to="/" className="flex items-center gap-3 px-5 py-6">
        <img
          src={garageLogo}
          alt=""
          className="h-11 w-11 rounded-lg bg-white p-1"
        />
        <span>
          <span className="block text-lg font-extrabold leading-none tracking-tight">
            Garage
          </span>
          <span className="mt-1 block text-xs text-base-content/70">
            Storage console
          </span>
        </span>
      </Link>
      <nav aria-label="Main navigation" className="flex-1 px-3">
        <ul className="flex flex-col gap-1">
          {pages.map((page) => {
            const active = page.exact
              ? pathname === page.path
              : pathname.startsWith(page.path);
            return (
              <li key={page.path}>
                <Link
                  to={page.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-primary/15 font-bold text-base-content"
                      : "font-semibold text-base-content/80 hover:bg-base-content/10 hover:text-base-content",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-primary transition-transform duration-150",
                      active
                        ? "scale-y-100"
                        : "scale-y-0 group-hover:scale-y-50",
                    )}
                  />
                  <page.icon
                    size={18}
                    aria-hidden
                    className={active ? "text-primary" : undefined}
                  />
                  {page.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-3 border-t border-base-300 p-4">
        <QuorumChip />
        <p className="truncate px-1 text-sm font-bold" title={auth.displayName}>
          {auth.displayName || "Administrator"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="justify-start"
            icon={theme === "dark" ? Sun : Moon}
            onClick={() =>
              appStore.setTheme(theme === "dark" ? "light" : "dark")
            }
            aria-label={
              theme === "dark"
                ? "Switch to light appearance"
                : "Switch to dark appearance"
            }
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button
            size="sm"
            className="justify-start"
            icon={LogOut}
            loading={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
