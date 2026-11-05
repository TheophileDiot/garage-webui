import { cn } from "@/lib/utils";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { ReactNode } from "react";

const tones = {
  warn: {
    box: "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-warn-soft",
    icon: "text-warn",
    Icon: TriangleAlert,
  },
  bad: {
    box: "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-bad-soft",
    icon: "text-bad",
    Icon: CircleAlert,
  },
  info: {
    box: "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-primary-soft",
    icon: "text-link",
    Icon: Info,
  },
} as const;

/**
 * A banner inside a page: an icon, a sentence and an optional link or button on the right. The icon and the words
 * carry the tone, the tint only supports them. Announced politely as a status; use `alert` for a failure.
 */
export const Notice = ({
  tone = "warn",
  children,
  action,
  alert = false,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  action?: ReactNode;
  alert?: boolean;
  className?: string;
}) => {
  const t = tones[tone];
  return (
    <div
      role={alert ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-ink max-md:items-start",
        t.box,
        className,
      )}
    >
      <t.Icon size={20} aria-hidden className={cn("shrink-0", t.icon)} />
      <div className="min-w-0 flex-1 basis-60 [overflow-wrap:anywhere]">
        {children}
      </div>
      {action ? (
        // Under the text on phone, lined up with it (icon 20 px + gap 12 px).
        <div className="shrink-0 font-semibold max-md:ml-8">{action}</div>
      ) : null}
    </div>
  );
};
