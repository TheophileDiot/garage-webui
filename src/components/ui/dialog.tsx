import * as RDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { PropsWithChildren, ReactNode, useLayoutEffect, useRef } from "react";
import Button from "./button";
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
        <RDialog.Overlay className="veil fixed inset-0 z-[60] bg-scrim" />
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
            "dialog-in fixed inset-x-0 bottom-0 z-[70] max-h-[92dvh] overflow-auto rounded-t-xl border border-line-strong bg-surface shadow-pop md:inset-x-auto md:bottom-auto md:left-1/2 md:top-[12vh] md:-translate-x-1/2 md:rounded-xl",
            widths[size ?? "md"],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <RDialog.Title className="font-cond text-[18px] font-semibold leading-snug [overflow-wrap:anywhere]">
                {title}
              </RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-caption text-ink-3">
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
                disabled={!dismissible}
                className="-mr-2 -mt-1"
              />
            </RDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
          {actions ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
              {actions}
            </div>
          ) : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
};

/**
 * The Cancel and submit pair of a form dialog, for the `actions` of a `Dialog`. The submit button belongs to the
 * form with the id `formId`; while `pending` it spins and Cancel is off.
 */
export const FormActions = ({
  onCancel,
  pending,
  formId,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  pending: boolean;
  formId: string;
  submitLabel: ReactNode;
  /** The submit button is off while true (nothing to submit yet). */
  disabled?: boolean;
}) => (
  <>
    <Button onClick={onCancel} disabled={pending}>
      Cancel
    </Button>
    <Button
      type="submit"
      form={formId}
      variant="primary"
      loading={pending}
      disabled={disabled}
    >
      {submitLabel}
    </Button>
  </>
);

export default Dialog;
