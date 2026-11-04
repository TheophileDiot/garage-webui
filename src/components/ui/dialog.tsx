import * as RDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { PropsWithChildren, ReactNode, useLayoutEffect, useRef } from "react";
import IconButton from "./icon-button";

type Size = "sm" | "md" | "lg" | "xl";

const widths: Record<Size, string> = {
  sm: "md:w-[min(26rem,92vw)]",
  md: "md:w-[min(30rem,92vw)]",
  lg: "md:w-[min(36rem,92vw)]",
  xl: "md:w-[min(48rem,92vw)]",
};

type Props = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Width on desktop. A phone always gets a bottom sheet. */
  size?: Size;
  /** False while an action runs: Escape, the backdrop and the close button stop closing it. */
  dismissible?: boolean;
}>;

/** Radix Dialog: focus trap, Escape, return focus, labelled by its title. Centred on desktop, a sheet on phone. */
const Dialog = ({
  open,
  onClose,
  title,
  description,
  actions,
  size,
  dismissible = true,
  children,
}: Props) => {
  const stop = (e: Event) => {
    if (!dismissible) e.preventDefault();
  };
  // Radix only returns focus to a Dialog.Trigger, and these dialogs are opened by state: remember the opener here.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement as HTMLElement | null;
  }, [open]);
  return (
    <RDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && dismissible) onClose();
      }}
    >
      <RDialog.Portal>
        <RDialog.Overlay className="veil fixed inset-0 z-40 bg-[rgb(0_0_0/0.55)]" />
        <RDialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus?.();
          }}
          onEscapeKeyDown={stop}
          onPointerDownOutside={stop}
          onInteractOutside={(e) => {
            // A toast is not "outside": clicking it must not close the dialog.
            if (
              (e.target as HTMLElement | null)?.closest("[data-sonner-toast]")
            )
              e.preventDefault();
            else stop(e);
          }}
          className={cn(
            "pop fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-auto rounded-t-lg border border-rule-strong bg-lift-2 shadow-[var(--shadow-pop)] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-[12vh] md:-translate-x-1/2 md:rounded-lg",
            widths[size ?? "md"],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <RDialog.Title className="font-display text-h3 font-semibold tracking-[-0.02em] [overflow-wrap:anywhere]">
                {title}
              </RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-ink-3">
                  {description}
                </RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">
                  {typeof title === "string" ? title : "Dialog"}
                </RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton
                label="Close dialog"
                icon={X}
                iconSize={16}
                disabled={!dismissible}
                className="-mr-2 -mt-1"
              />
            </RDialog.Close>
          </div>
          <div className="px-4 py-4">{children}</div>
          {actions ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-rule px-4 py-3">
              {actions}
            </div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
};

export default Dialog;
