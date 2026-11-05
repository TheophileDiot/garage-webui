import { stagedBadge } from "@/lib/phone-shell";
import { NavLink } from "react-router-dom";
import { NAV } from "./nav";

/**
 * The phone's primary navigation: Overview, Buckets, Access keys, Cluster, with the staged-changes count on
 * Cluster. The current page is marked with `aria-current` and a yellow tick, as in the sidebar. 56 px tall (48 px
 * on a short landscape screen, icon beside the word), every item at least 44 px wide.
 */
const BottomNav = ({ staged }: { staged: number }) => {
  const badge = stagedBadge(staged);
  return (
    <nav aria-label="Primary" className="flex">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          // A plain string, not `cn`: tailwind-merge reads `text-label` (a size) as a colour and drops it next to `text-sb-ink-2`.
          className={
            "group relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center text-label font-medium leading-[1.15] text-sb-ink-2 [@media(max-height:480px)]:min-h-12 [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:gap-2 " +
            "hover:text-sb-ink aria-[current=page]:text-sb-strong " +
            "before:absolute before:left-1/2 before:top-0 before:hidden before:h-[3px] before:w-9 before:-translate-x-1/2 before:rounded-b-[3px] before:bg-sb-tick aria-[current=page]:before:block"
          }
        >
          <span
            className={
              "relative" +
              // Icon beside the word (short landscape screens): the badge hangs 10 px to the right, past the 8 px gap.
              (n.to === "/cluster" && badge
                ? " [@media(max-height:480px)]:mr-2"
                : "")
            }
          >
            <n.icon
              size={22}
              aria-hidden
              className="group-aria-[current=page]:text-sb-icon-on"
            />
            {n.to === "/cluster" && badge ? (
              <span
                aria-hidden
                className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-sb-tick px-1 font-cond text-[11px] font-semibold leading-none text-sb-bg"
              >
                {badge.text}
              </span>
            ) : null}
          </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {n.label}
            {n.to === "/cluster" && badge ? (
              <span className="sr-only">, {badge.label}</span>
            ) : null}
          </span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
