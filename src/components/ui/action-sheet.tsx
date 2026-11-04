import * as RDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { PropsWithChildren, ReactNode } from "react";

/**
 * Action sheet for touch: a bottom sheet on the same Radix Dialog as every other overlay, so focus trap, Escape
 * and focus return come for free. Items run `onSelect`, then the sheet closes.
 */
export const ActionSheet = ({
  trigger,
  children,
  label = "Actions",
}: PropsWithChildren<{
  /** The element that opens the sheet (rendered with `asChild`, so give it a button). */
  trigger: ReactNode;
  label?: string;
}>) => (
  <RDialog.Root>
    <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>
    <RDialog.Portal>
      <RDialog.Overlay className="veil fixed inset-0 z-40 bg-[rgb(0_0_0/0.55)]" />
      <RDialog.Content className="pop fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-auto rounded-t-lg border border-rule-strong bg-lift-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)]">
        <RDialog.Title className="px-2 py-2 text-ink-3 [overflow-wrap:anywhere]">
          {label}
        </RDialog.Title>
        <RDialog.Description className="sr-only">
          Choose an action
        </RDialog.Description>
        <ul className="grid">{children}</ul>
      </RDialog.Content>
    </RDialog.Portal>
  </RDialog.Root>
);

export const ActionSheetItem = ({
  icon,
  children,
  onSelect,
  danger,
  href,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  /** A link instead of a button (for example a download). */
  href?: string;
}) => {
  const cls = cn(
    "flex h-11 w-full items-center gap-3 rounded-sm px-2 text-left active:bg-gold active:text-gold-ink",
    danger ? "text-bad" : "text-ink",
  );
  return (
    <li>
      <RDialog.Close asChild>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cls}
          >
            {icon}
            {children}
          </a>
        ) : (
          <button type="button" onClick={onSelect} className={cls}>
            {icon}
            {children}
          </button>
        )}
      </RDialog.Close>
    </li>
  );
};

export const ActionSheetSeparator = () => (
  <li role="separator" className="my-1 h-px bg-rule" />
);
