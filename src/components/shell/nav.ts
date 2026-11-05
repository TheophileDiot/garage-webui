import {
  Archive,
  KeyRound,
  LayoutDashboard,
  LucideIcon,
  Server,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  /** The place name the palette matches: `overview`, `buckets`, `keys`, `cluster`. */
  slug: string;
  /** The key pressed after `g`. Not shown in the nav: it is a shortcut, not a badge. */
  key: string;
  icon: LucideIcon;
  end: boolean;
};

type NavGroup = { label: string; items: readonly NavItem[] };

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Storage",
    items: [
      {
        to: "/",
        label: "Overview",
        slug: "overview",
        key: "o",
        icon: LayoutDashboard,
        end: true,
      },
      {
        to: "/buckets",
        label: "Buckets",
        slug: "buckets",
        key: "b",
        icon: Archive,
        end: false,
      },
      {
        to: "/keys",
        label: "Access keys",
        slug: "keys",
        key: "k",
        icon: KeyRound,
        end: false,
      },
    ],
  },
  {
    label: "Operate",
    items: [
      {
        to: "/cluster",
        label: "Cluster",
        slug: "cluster",
        key: "c",
        icon: Server,
        end: false,
      },
    ],
  },
];

export const NAV: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
