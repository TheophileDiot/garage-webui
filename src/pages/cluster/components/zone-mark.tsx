import { cn } from "@/lib/utils";

/** More zones than this and the mark would be unreadable: the zone name alone is shown. */
const MAX_MARK_ZONES = 7;

/**
 * A node's mark among the layout's zones: its own zone's bar is filled when the node is up and an outline when it is
 * down; the other zones stay as quiet ticks. Zones come from the layout, never from a fixed list. Always paired
 * with the zone and status in words.
 */
const ZoneMark = ({
  zone,
  zones,
  up,
  className,
}: {
  zone: string | null;
  zones: string[];
  up: boolean;
  className?: string;
}) => {
  if (!zone || zones.length === 0 || zones.length > MAX_MARK_ZONES) return null;
  const own = zones.indexOf(zone);
  const width = zones.length * 6.5 - 1.5;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 14`}
      width={width}
      height={14}
      className={cn("shrink-0", className)}
    >
      {zones.map((z, i) =>
        i === own ? (
          <rect
            key={z}
            x={i * 6.5 + (up ? 0 : 0.6)}
            y={up ? 1 : 1.6}
            width={up ? 5 : 3.8}
            height={up ? 12 : 10.8}
            rx="1"
            fill={up ? "var(--ok)" : "none"}
            stroke={up ? "none" : "var(--bad)"}
            strokeWidth="1.4"
          />
        ) : (
          <rect
            key={z}
            x={i * 6.5 + 1.5}
            y="5"
            width="2"
            height="4"
            rx="0.5"
            fill="var(--ink-3)"
            opacity="0.55"
          />
        ),
      )}
    </svg>
  );
};

export default ZoneMark;
