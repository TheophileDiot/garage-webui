import {
  Archive,
  KeyRound,
  LayoutGrid,
  LucideIcon,
  Network,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  /** The key pressed after `g`. */
  key: string;
  icon: LucideIcon;
  end: boolean;
};

export const NAV: readonly NavItem[] = [
  { to: "/", label: "overview", key: "o", icon: LayoutGrid, end: true },
  { to: "/buckets", label: "buckets", key: "b", icon: Archive, end: false },
  { to: "/keys", label: "keys", key: "k", icon: KeyRound, end: false },
  { to: "/cluster", label: "cluster", key: "c", icon: Network, end: false },
];
