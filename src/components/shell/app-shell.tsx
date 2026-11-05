import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import api from "@/lib/api";
import { barKind, chipWord } from "@/lib/phone-shell";
import { cn, url } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  CSSProperties,
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { hit44 } from "../ui/button-styles";
import { afterSheetsClosed } from "../ui/use-sheet-back";
import IconButton from "../ui/icon-button";
import Kbd from "../ui/kbd";
import { StateGlyph } from "../ui/state-glyph";
import { BottomBarProvider } from "./bottom-bar";
import { useBottomBarState } from "./bottom-bar-context";
import BottomNav from "./bottom-nav";
import Breadcrumbs from "./breadcrumbs";
import HealthSheet from "./health-sheet";
import { NAV } from "./nav";
import SidebarContent from "./sidebar";
import { useClusterSummary } from "./use-cluster-summary";
import UserMenu from "./user-menu";

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

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

const healthTone = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  idle: "bg-surface-2 text-ink-2",
} as const;

/**
 * The frame around every signed-in page. From 961 px: the dark sidebar, and a top bar with breadcrumbs and the
 * search button. Below it (phone): no sidebar; the top bar carries breadcrumbs, the search button, a health chip
 * with its word (it opens the health sheet) and the account button, and a bottom bar holds the navigation, or a
 * page's own contextual bar while one is mounted (`BottomBarSlot`). Pages render inside the main element with
 * their own PageHeader.
 */
const AppShell = ({ children }: PropsWithChildren) => {
  const { signOut, pending } = useSignOut();
  const cluster = useClusterSummary();
  const navigate = useNavigate();
  const auth = useAuth();

  // The sidebar is the fixed column from 961 px up; below it the shell is the phone shell (bottom bar, no sidebar).
  const wide = useMediaQuery("(min-width: 961px)");
  const bottom = useBottomBarState();
  const kind = barKind({ wide, claims: bottom.claims });
  const [healthOpen, setHealthOpen] = useState(false);
  useEffect(() => {
    if (wide) setHealthOpen(false);
  }, [wide]);
  // The health sheet is shell state, so a route change would leave it open over the next page: close it.
  const { pathname } = useLocation();
  useEffect(() => setHealthOpen(false), [pathname]);

  // The bar's height, safe area included: pages pad their end by it and the Top button rides above it.
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState<number>();
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) {
      setBarH(undefined);
      return;
    }
    const measure = () => setBarH(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wide]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  // The palette is a dialog opened by state, so it returns focus to whatever had it (the search button, say).
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

  return (
    <BottomBarProvider value={bottom.value}>
      <div
        style={
          barH === undefined
            ? undefined
            : ({ "--bar-h": `${barH}px` } as CSSProperties)
        }
        className="min-h-dvh nav:grid nav:grid-cols-[var(--sb-w)_minmax(0,1fr)]"
      >
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        {wide ? (
          <div className="border-r border-sb-line bg-sb-bg">
            <aside aria-label="Sidebar" className="sticky top-0 h-dvh">
              <SidebarContent onSignOut={signOut} signingOut={pending} />
            </aside>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-[calc(52px+env(safe-area-inset-top,0px))] items-center gap-1.5 border-b border-line bg-bg pl-[max(1rem,env(safe-area-inset-left,0px))] pt-[env(safe-area-inset-top,0px)] pr-[max(0.5rem,env(safe-area-inset-right,0px))] nav:gap-3 nav:px-8">
            <Breadcrumbs />
            {!wide ? (
              <button
                type="button"
                onClick={() => setHealthOpen(true)}
                aria-haspopup="dialog"
                aria-label={`${chipWord(cluster.word)}. ${cluster.nodes}, ${cluster.layout}. Cluster health`}
                // A template, not `cn`: tailwind-merge drops `text-caption` (a size) next to the tone's `text-ok` colour.
                className={`${hit44} inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-2.5 text-caption font-medium ${healthTone[cluster.tone]}`}
              >
                <StateGlyph
                  state={
                    cluster.tone === "ok"
                      ? "full"
                      : cluster.tone === "warn"
                        ? "degraded"
                        : cluster.tone === "bad"
                          ? "lost"
                          : "unknown"
                  }
                  size={16}
                />
                {/* Below 280 px there is no room for the word; it stays in the accessible name. */}
                <span className="max-[279px]:sr-only">
                  {chipWord(cluster.word)}
                </span>
              </button>
            ) : null}
            <IconButton
              label="Search"
              icon={Search}
              onClick={openPalette}
              className="nav:hidden"
            />
            <button
              type="button"
              onClick={openPalette}
              aria-haspopup="dialog"
              aria-label="Search buckets, keys and pages"
              className="hidden h-[34px] w-[280px] items-center gap-2 rounded border border-line-strong bg-surface pl-2.5 pr-2 text-left text-ink-3 hover:border-ink-3 nav:flex"
            >
              <Search size={16} aria-hidden />
              <span className="flex-1">Search…</span>
              <Kbd>{isMac() ? "⌘ K" : "Ctrl K"}</Kbd>
            </button>
            {!wide ? (
              <UserMenu
                variant="bar"
                name={auth.displayName || "Administrator"}
                onSignOut={signOut}
                signingOut={pending}
              />
            ) : null}
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="w-full max-w-[1400px] flex-1 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[calc(var(--bar-h,0px)+4rem)] pt-5 outline-none nav:px-8 nav:pt-6"
          >
            {children}
          </main>
        </div>

        {kind !== "none" ? (
          <div
            ref={barRef}
            data-bottom-bar={kind}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]",
              kind === "nav"
                ? "border-sb-line bg-sb-bg"
                : "border-line-strong bg-surface",
            )}
          >
            {kind === "nav" ? <BottomNav staged={cluster.staged} /> : null}
            <div ref={bottom.setEl} />
          </div>
        ) : null}

        {!wide ? (
          <HealthSheet
            open={healthOpen}
            onClose={() => setHealthOpen(false)}
            onOpenCluster={() => {
              setHealthOpen(false);
              afterSheetsClosed(() => navigate("/cluster"));
            }}
          />
        ) : null}

        {paletteOpen ? (
          <Suspense fallback={null}>
            <Palette
              open={paletteOpen}
              onOpenChange={setPaletteOpen}
              onSignOut={signOut}
            />
          </Suspense>
        ) : null}
      </div>
    </BottomBarProvider>
  );
};

export default AppShell;
