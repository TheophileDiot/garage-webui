import garageLogo from "@/assets/garage-logo.svg";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  TriangleAlert,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { StatusGlyph } from "../ui/state-glyph";
import { NAV_GROUPS } from "./nav";
import { useClusterSummary } from "./use-cluster-summary";
import UserMenu from "./user-menu";

const healthIcon = {
  ok: { Icon: CircleCheck, cls: "text-sb-ok" },
  warn: { Icon: TriangleAlert, cls: "text-sb-warn" },
  bad: { Icon: CircleAlert, cls: "text-sb-bad" },
  idle: { Icon: CircleDashed, cls: "text-sb-ink-2" },
} as const;

/** Brand tile and name. The tile keeps the Garage yellow in both themes. */
const Brand = ({ onNavigate }: { onNavigate?: () => void }) => (
  <Link
    to="/"
    onClick={onNavigate}
    aria-label="Garage console, overview"
    className="flex items-center gap-2.5 px-4 pb-3.5 pt-4 text-sb-ink"
  >
    <span
      aria-hidden
      className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[7px] bg-brand"
    >
      <img src={garageLogo} alt="" width={22} height={22} />
    </span>
    <span>
      <span className="block font-cond text-[17px] font-semibold leading-[1.1] tracking-[0.01em] text-sb-strong">
        Garage
      </span>
      <span className="mt-0.5 block text-label text-sb-ink-2">
        Storage console
      </span>
    </span>
  </Link>
);

/**
 * The cluster health block: status word with its icon, the 16 x 16 glyph, node and layout counts. When the health
 * reading is unavailable (a failed refresh included) it says why and offers a retry instead of any count.
 */
const HealthBlock = ({ onNavigate }: { onNavigate?: () => void }) => {
  const cluster = useClusterSummary();
  const { Icon, cls } = healthIcon[cluster.tone];
  return (
    <div className="rounded-lg border border-sb-line">
      <Link
        to="/cluster"
        onClick={onNavigate}
        aria-label={cluster.sidebarLabel}
        className="block rounded-lg px-3 py-2.5 text-sb-ink hover:bg-sb-hover"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Icon size={18} aria-hidden className={cn("flex-none", cls)} />
          <span className="min-w-0 first-letter:uppercase">{cluster.word}</span>
          <StatusGlyph
            health={cluster.health}
            size={32}
            onSidebar
            className="ml-auto outline outline-1 outline-offset-1 outline-sb-line"
          />
        </span>
        <span className="mt-0.5 block pl-[26px] text-[12.5px] text-sb-ink-2">
          {cluster.unavailableReason ?? `${cluster.nodes} · ${cluster.layout}`}
        </span>
      </Link>
      {cluster.failed || cluster.unavailableReason ? (
        <div className="px-3 pb-2.5 pl-[38px]">
          <button
            type="button"
            onClick={cluster.retry}
            className="min-h-6 rounded-sm text-[12.5px] font-medium text-sb-ink underline underline-offset-2 hover:text-sb-strong"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The dark Dock sidebar: brand, grouped navigation (Storage, Operate with the staged-changes tag), the cluster
 * health block and the account menu. The same content fills the fixed column on desktop and the drawer on phone.
 */
const SidebarContent = ({
  onNavigate,
  onSignOut,
  signingOut,
}: {
  onNavigate?: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) => {
  const auth = useAuth();
  const { staged } = useClusterSummary();
  const who = auth.displayName || "Administrator";

  return (
    <div
      data-sidebar
      className="flex h-full min-h-0 flex-col bg-sb-bg text-sb-ink"
    >
      <Brand onNavigate={onNavigate} />
      <nav
        aria-label="Primary"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1.5"
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p
              className={cn(
                "px-2 pb-2 font-cond text-[11.5px] font-medium uppercase leading-none tracking-[0.09em] text-sb-ink-2",
                gi === 0 ? "pt-1.5" : "pt-4",
              )}
            >
              {group.label}
            </p>
            {group.items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={onNavigate}
                className={cn(
                  "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 font-medium text-sb-ink hover:bg-sb-hover",
                  "aria-[current=page]:bg-sb-active aria-[current=page]:text-sb-strong",
                  "before:absolute before:-left-2.5 before:bottom-2 before:top-2 before:hidden before:w-[3px] before:rounded-r-[3px] before:bg-sb-tick aria-[current=page]:before:block",
                )}
              >
                <n.icon
                  size={16}
                  aria-hidden
                  className="flex-none text-sb-ink-2 group-aria-[current=page]:text-sb-icon-on"
                />
                {n.label}
                {n.to === "/cluster" && staged > 0 ? (
                  <span
                    aria-label={`${staged} staged layout ${staged === 1 ? "change" : "changes"}`}
                    className="ml-auto rounded border border-sb-tag-line px-1.5 py-[3px] font-cond text-label font-medium leading-none tracking-[0.02em] text-sb-warn"
                  >
                    {staged} staged
                  </span>
                ) : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-sb-line p-2.5">
        <HealthBlock onNavigate={onNavigate} />
        <UserMenu name={who} onSignOut={onSignOut} signingOut={signingOut} />
      </div>
    </div>
  );
};

export default SidebarContent;
