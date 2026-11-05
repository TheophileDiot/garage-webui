import * as RDialog from "@radix-ui/react-dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import api from "@/lib/api";
import { cn, url } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Menu, Search } from "lucide-react";
import {
  lazy,
  PropsWithChildren,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import IconButton from "../ui/icon-button";
import Kbd from "../ui/kbd";
import { StateGlyph } from "../ui/state-glyph";
import Breadcrumbs from "./breadcrumbs";
import { NAV } from "./nav";
import SidebarContent from "./sidebar";
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

const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

const healthTone = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  idle: "bg-surface-2 text-ink-2",
} as const;

/**
 * The frame around every signed-in page: the dark sidebar (a drawer on phone), a top bar with breadcrumbs and the
 * search button, and the palette. Pages render inside the main element with their own PageHeader.
 */
const AppShell = ({ children }: PropsWithChildren) => {
  const { signOut, pending } = useSignOut();
  const cluster = useClusterSummary();
  const navigate = useNavigate();

  // The sidebar is the fixed column from 961 px up and a drawer below; the drawer is a modal dialog, so it traps
  // focus, closes on Escape and returns focus to the menu button.
  const wide = useMediaQuery("(min-width: 961px)");
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (wide) setDrawer(false);
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

  const sidebar = (onNavigate?: () => void) => (
    <SidebarContent
      onNavigate={onNavigate}
      onSignOut={signOut}
      signingOut={pending}
    />
  );

  return (
    <div className="min-h-dvh nav:grid nav:grid-cols-[var(--sb-w)_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {wide ? (
        <div className="border-r border-sb-line bg-sb-bg">
          <aside aria-label="Sidebar" className="sticky top-0 h-dvh">
            {sidebar()}
          </aside>
        </div>
      ) : (
        <RDialog.Root open={drawer} onOpenChange={setDrawer}>
          <RDialog.Portal>
            <RDialog.Overlay className="veil fixed inset-0 z-[60] bg-scrim" />
            <RDialog.Content
              aria-describedby={undefined}
              onCloseAutoFocus={(e) => {
                // Radix returns focus only to a Trigger; this drawer is opened by state.
                e.preventDefault();
                menuButton.current?.focus();
              }}
              className="drawer fixed bottom-0 left-0 top-0 z-[70] w-[min(280px,86vw)] border-r border-sb-line bg-sb-bg"
            >
              <RDialog.Title className="sr-only">Navigation</RDialog.Title>
              {sidebar(() => setDrawer(false))}
            </RDialog.Content>
          </RDialog.Portal>
        </RDialog.Root>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-[52px] items-center gap-1.5 border-b border-line bg-bg px-2 nav:gap-3 nav:px-8">
          {!wide ? (
            <IconButton
              ref={menuButton}
              label="Open navigation"
              icon={Menu}
              onClick={() => setDrawer(true)}
              aria-expanded={drawer}
            />
          ) : null}
          <Breadcrumbs />
          {!wide ? (
            <Link
              to="/cluster"
              aria-label={`${cluster.label}. ${cluster.nodes}, ${cluster.layout}`}
              className={cn(
                "inline-flex size-9 flex-none items-center justify-center rounded-full",
                healthTone[cluster.tone],
              )}
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
              <span className="sr-only">
                {cluster.word.charAt(0).toUpperCase() + cluster.word.slice(1)}
              </span>
            </Link>
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
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="w-full max-w-[1400px] flex-1 px-4 pb-16 pt-5 outline-none nav:px-8 nav:pt-6"
        >
          {children}
        </main>
      </div>

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
  );
};

export default AppShell;
