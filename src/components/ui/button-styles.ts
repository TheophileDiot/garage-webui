import { cn } from "@/lib/utils";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "ghost-danger";
export type ButtonSize = "sm" | "md";

/** Shared by Button, IconButton and anything that must look like one (a link, a menu trigger). */
export const buttonBase =
  "inline-flex select-none items-center justify-center gap-[7px] whitespace-nowrap rounded border text-body font-medium " +
  "transition-colors duration-100 active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/** Controls are 34 px on desktop and 36 px on touch; small ones are 30 px on desktop and 36 px on touch too. Never below 24 x 24. */
export const buttonSizes: Record<ButtonSize, { text: string; icon: string }> = {
  md: {
    text: "h-9 px-3.5 md:h-[34px]",
    icon: "h-9 w-9 shrink-0 md:h-[34px] md:w-[34px]",
  },
  sm: {
    text: "h-9 px-2.5 text-caption md:h-[30px]",
    icon: "h-9 w-9 shrink-0 md:h-[30px] md:w-[30px]",
  },
};

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-primary-ink hover:border-primary-hover hover:bg-primary-hover",
  secondary:
    "border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-surface-2",
  ghost:
    "border-transparent bg-transparent text-ink-3 hover:border-line hover:bg-surface-2 hover:text-ink",
  "ghost-danger":
    "border-transparent bg-transparent text-ink-3 hover:border-bad hover:bg-bad-soft hover:text-bad",
  danger:
    "border-line-strong bg-surface text-bad hover:border-bad hover:bg-bad-soft",
};

/** The class list of a button: base, size, variant, then the caller's own. For Button, IconButton and anything styled like one. */
export const buttonClass = ({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon button sizing instead of text button sizing. */
  iconOnly?: boolean;
  className?: string;
} = {}) =>
  cn(
    buttonBase,
    buttonSizes[size][iconOnly ? "icon" : "text"],
    buttonVariants[variant],
    className,
  );
