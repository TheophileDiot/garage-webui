import { cn } from "@/lib/utils";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "ghost-danger";
export type ButtonSize = "sm" | "md";

/**
 * Touch hit area: the visual size stays 36 px, a transparent ::after grows the target to 44 px below `md`. Two
 * neighbours 8 px apart then share the gap exactly. Put it on anything small that a thumb presses (a link, a
 * checkbox label); `buttonBase` has it. It carries `relative` below `md` only (a positioned box anti-aliases its
 * rounded corners a hair differently, and desktop must not change a pixel), and not when the caller positions the
 * control itself (`fixed`, `absolute`, `sticky`): its own position is the anchor of the ::after.
 */
export const hit44 =
  "touch:[&:not(.fixed,.absolute,.sticky)]:relative touch:after:absolute touch:after:-inset-1 touch:after:content-['']";

/** `hit44` for a control with a 1 px border: the pseudo-element is placed from the padding box, so it reaches 1 px further. */
const hit44Bordered =
  "touch:[&:not(.fixed,.absolute,.sticky)]:relative touch:after:absolute touch:after:-inset-[5px] touch:after:content-['']";

/** Shared by Button, IconButton and anything that must look like one (a link, a menu trigger). */
export const buttonBase =
  hit44Bordered +
  " inline-flex select-none items-center justify-center gap-[7px] whitespace-nowrap rounded border text-body font-medium " +
  "transition-colors duration-100 active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

/** Controls are 34 px on desktop and 36 px on touch; small ones are 30 px on desktop and 36 px on touch too. Never below 24 x 24. */
export const buttonSizes: Record<ButtonSize, { text: string; icon: string }> = {
  md: {
    text: "h-9 px-3.5 desk:h-[34px]",
    icon: "h-9 w-9 shrink-0 desk:h-[34px] desk:w-[34px]",
  },
  sm: {
    text: "h-9 px-2.5 text-caption desk:h-[30px]",
    icon: "h-9 w-9 shrink-0 desk:h-[30px] desk:w-[30px]",
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
