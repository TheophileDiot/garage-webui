import { cn } from "@/lib/utils";
import { NavLink } from "react-router-dom";
import { NAV } from "./nav";

/** One tab bar for every page on a phone: icon and label on all four, the current one marked by weight and a bar. */
const TabBar = () => (
  <nav
    aria-label="Primary"
    className="fixed inset-x-0 bottom-0 z-30 border-t border-rule-strong bg-ground pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <ul className="grid grid-cols-4">
      {NAV.map((n) => (
        <li key={n.to}>
          <NavLink
            to={n.to}
            end={n.end}
            className={cn(
              "relative flex h-14 flex-col items-center justify-center gap-0.5 text-caption text-ink-3 transition-colors duration-caret hover:bg-fill hover:text-ink",
              "after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:scale-x-0 after:bg-gold after:transition-transform after:duration-caret aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:after:scale-x-100",
            )}
          >
            <n.icon size={17} aria-hidden />
            <span>{n.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

export default TabBar;
