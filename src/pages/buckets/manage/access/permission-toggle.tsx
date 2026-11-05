import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Perm = "read" | "write" | "owner";

const PERMS: { perm: Perm; label: string }[] = [
  { perm: "read", label: "Read" },
  { perm: "write", label: "Write" },
  { perm: "owner", label: "Owner" },
];

/**
 * Read, Write and Owner of one key as three joined 44 px toggles (each on or off on its own, as Garage grants them),
 * for the phone sheet where three checkbox rows per key would take 175 px. A pressed segment shows a tick as well as
 * the fill, so the state never rests on colour alone.
 */
const PermissionToggle = ({
  label,
  values,
  onChange,
}: {
  /** The key's name, for the accessible names. */
  label: string;
  values: Record<Perm, boolean>;
  onChange: (perm: Perm, on: boolean) => void;
}) => (
  <div
    role="group"
    aria-label={`Permissions for ${label}`}
    className="grid grid-cols-3 overflow-hidden rounded border border-line-strong"
  >
    {PERMS.map(({ perm, label: text }) => {
      const on = values[perm];
      return (
        <button
          key={perm}
          type="button"
          aria-pressed={on}
          aria-label={`${text} for ${label}`}
          onClick={() => onChange(perm, !on)}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 border-l border-line-strong font-medium transition-colors duration-100 first:border-l-0",
            on
              ? "bg-primary text-primary-ink"
              : "bg-surface text-ink hover:bg-surface-2",
          )}
        >
          {on ? <Check size={14} aria-hidden /> : null}
          {text}
        </button>
      );
    })}
  </div>
);

export default PermissionToggle;
