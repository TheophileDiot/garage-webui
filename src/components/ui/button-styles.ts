export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "ghost-danger";
export type ButtonSize = "sm" | "md";

/**
 * Caret verb: on hover a block wipes in from the left under the label (scaleX, 120 ms).
 * Primary rests on gold and wipes to ink; the others rest transparent and wipe to gold (danger: red).
 */
export const buttonBase =
  "relative isolate inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-sm border text-body font-medium " +
  "transition-[color,transform] duration-caret ease-caret active:translate-y-px " +
  "before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:transition-transform before:duration-caret before:ease-caret " +
  "hover:before:scale-x-100 focus-visible:before:scale-x-100 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** Controls are 28 px on desktop and 36 px on touch; small ones 24 px and 32 px. Never below 24 x 24. */
export const buttonSizes: Record<ButtonSize, { text: string; icon: string }> = {
  md: { text: "h-9 px-3 md:h-7", icon: "h-9 w-9 shrink-0 md:h-7 md:w-7" },
  sm: { text: "h-8 px-2 md:h-6", icon: "h-8 w-8 shrink-0 md:h-6 md:w-6" },
};

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-gold bg-gold text-gold-ink before:bg-transparent hover:before:bg-ink focus-visible:before:bg-ink hover:text-ground focus-visible:text-ground",
  secondary:
    "border-rule-strong bg-transparent text-ink before:bg-transparent hover:before:bg-gold focus-visible:before:bg-gold hover:border-gold hover:text-gold-ink focus-visible:text-gold-ink",
  ghost:
    "border-transparent bg-transparent text-ink-2 before:bg-transparent hover:before:bg-fill focus-visible:before:bg-fill hover:text-ink focus-visible:text-ink",
  "ghost-danger":
    "border-transparent bg-transparent text-ink-2 before:bg-transparent hover:before:bg-bad focus-visible:before:bg-bad hover:text-ground focus-visible:text-ground",
  danger:
    "border-bad bg-transparent text-bad before:bg-transparent hover:before:bg-bad focus-visible:before:bg-bad hover:text-ground focus-visible:text-ground",
};
