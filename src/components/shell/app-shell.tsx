import garageLogo from "@/assets/garage-logo.svg";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { url } from "@/lib/utils";
import appStore from "@/stores/app-store";
import { useMutation } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import {
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useStore } from "zustand";
import IconButton from "../ui/icon-button";
import Kbd from "../ui/kbd";
import { StatusGlyph } from "../ui/state-glyph";
import { Status } from "../ui/status";
import AddressBar from "./address-bar";
import { NAV } from "./nav";
import TabBar from "./tab-bar";
import { useClusterSummary } from "./use-cluster-summary";

const loadPalette = () => import("./palette");
const Palette = lazy(loadPalette);

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Sign out: the app's own logout, then a full load of the login page under the base path. */
const useSignOut = () => {
  const mutation = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      window.location.href = url("/auth/login");
    },
    onError: (error) => toast.error(error.message || "Could not sign out"),
  });
  return { signOut: () => mutation.mutate(), pending: mutation.isPending };
};

/**
 * The frame around every signed-in page: desktop rail, address bar, phone tab bar and the palette.
 * Pages render inside the main element with their own PageHeader.
 */
const AppShell = ({ children }: PropsWithChildren) => {
  const theme = useStore(appStore, (s) => s.theme);
  const toggleTheme = () =>
    appStore.setTheme(theme === "dark" ? "light" : "dark");
  const themeLabel =
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const auth = useAuth();
  const { signOut, pending } = useSignOut();
  const cluster = useClusterSummary();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [paletteOpen, setPaletteOpen] = useState(false);
  // The palette is a dialog opened by state, so it returns focus to whatever had it (the address bar button, say).
  const opener = useRef<HTMLElement | null>(null);
  const openPalette = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setPaletteOpen(true);
  }, []);
  useEffect(() => {
    if (paletteOpen || !opener.current) return;
    const el = opener.current;
    opener.current = null;
    // After Radix has unmounted its focus scope. Only when focus was lost: a navigation may have put it elsewhere.
    const t = window.setTimeout(() => {
      if (el.isConnected && document.activeElement === document.body)
        el.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [paletteOpen]);
  const pendingG = useRef<number | null>(null);
  const navigated = useRef(false);
  useEffect(() => {
    navigated.current = true;
  }, [pathname]);

  // Fetch the palette chunk in idle time so the first Ctrl+K opens at once.
  useEffect(() => {
    const t = window.setTimeout(() => void loadPalette(), 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Ctrl/Cmd+K or / opens the palette; g then o, b, k, c jumps. Ignored while typing or with another dialog open.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!paletteOpen && document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        if (paletteOpen) setPaletteOpen(false);
        else openPalette();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (paletteOpen || document.querySelector('[role="dialog"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const hit = NAV.find((n) => n.key === e.key.toLowerCase());
        if (hit) navigate(hit.to);
        return;
      }
      if (e.key === "g")
        pendingG.current = window.setTimeout(
          () => (pendingG.current = null),
          900,
        );
    },
    [navigate, paletteOpen, openPalette],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const who = auth.displayName || "Administrator";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13rem_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Rail (desktop) */}
      <aside
        className="sticky top-0 hidden h-dvh flex-col border-r border-rule md:flex"
        aria-label="Sidebar"
      >
        <Link
          to="/"
          className="caret-row flex h-11 items-center gap-2.5 border-b border-rule px-3.5"
          aria-label="Garage console, overview"
        >
          <img
            src={garageLogo}
            alt=""
            width={22}
            height={22}
            className="rounded-sm bg-[#fff3c4] p-0.5"
          />
          <span className="font-display text-h3 font-semibold tracking-[-0.03em]">
            garage
          </span>
        </Link>
        <nav aria-label="Primary" className="flex-1 px-2 py-3">
          <ul className="grid gap-px">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className="caret-row flex h-8 items-center gap-2 rounded-sm px-2.5 text-ink-2 hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
                >
                  <n.icon size={14} aria-hidden />
                  {n.label}
                  <span className="ml-auto flex gap-0.5">
                    <Kbd>g</Kbd>
                    <Kbd>{n.key}</Kbd>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-2 border-t border-rule p-3">
          <Link
            to="/cluster"
            aria-label={cluster.railLabel}
            className="caret-row -mx-1 flex items-center gap-2.5 rounded-sm px-1 py-1"
          >
            <StatusGlyph health={cluster.health} size={30} />
            <span className="grid min-w-0 gap-0.5">
              <Status tone={cluster.tone}>{cluster.word}</Status>{" "}
              <span className="text-caption text-ink-3">
                {cluster.nodes} <span className="block">{cluster.layout}</span>
              </span>
            </span>
          </Link>
          <div className="grid gap-0.5 text-caption text-ink-3">
            <span className="min-w-0 truncate" title={who}>
              {who}
            </span>
            <button
              type="button"
              onClick={signOut}
              disabled={pending}
              className="caret-row -ml-1.5 inline-flex min-h-6 items-center gap-1 justify-self-start rounded-sm px-1.5 hover:text-ink disabled:opacity-40"
            >
              <LogOut size={12} aria-hidden /> sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-14 md:pb-0">
        {/* Top bar: the address bar is the centre of the product. */}
        <header className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-rule bg-ground px-4 md:px-5">
          <Link
            to="/"
            className="-m-1 shrink-0 p-1 md:hidden"
            aria-label="Garage console, overview"
          >
            <img
              src={garageLogo}
              alt=""
              width={22}
              height={22}
              className="rounded-sm bg-[#fff3c4] p-0.5"
            />
          </Link>
          <AddressBar onOpenPalette={openPalette} />
          <Link
            to="/cluster"
            className="-m-1 ml-auto shrink-0 rounded-sm p-1 transition-colors duration-caret hover:bg-fill md:hidden"
            aria-label={`${cluster.label}. ${cluster.nodes}, ${cluster.layout}`}
          >
            <StatusGlyph health={cluster.health} size={24} />
          </Link>
          <IconButton
            label={themeLabel}
            icon={ThemeIcon}
            onClick={toggleTheme}
            className="shrink-0 md:ml-auto"
          />
          <IconButton
            label="Sign out"
            icon={LogOut}
            onClick={signOut}
            disabled={pending}
            className="shrink-0 md:hidden"
          />
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1200px] flex-1 px-4 outline-none md:px-5"
        >
          <div
            key={pathname}
            className={navigated.current ? "page-in" : undefined}
          >
            {children}
          </div>
        </main>
      </div>

      <TabBar />

      {paletteOpen ? (
        <Suspense fallback={null}>
          <Palette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={signOut}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default AppShell;
