import * as RDialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  PropsWithChildren,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Button from "./button";
import IconButton from "./icon-button";
import { useSheetBack } from "./use-sheet-back";
import { useSheetKeyboard } from "./use-sheet-keyboard";

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

/**
 * Radix Dialog: focus trap, Escape, return focus, labelled by its title. Centred on desktop, a sheet on phone:
 * header and `actions` stay pinned, the body scrolls between them (up to 88 dvh on phone, so the footer is never
 * off screen, landscape included). On phone the footer buttons are full width, 44 px tall, primary first.
 */
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
  // The sheet rides above the soft keyboard while a field in it has focus.
  const [content, setContent] = useState<HTMLElement | null>(null);
  useSheetKeyboard(content);
  // Android Back closes the sheet (and does not leave the page); an action that runs keeps it open.
  useSheetBack(open, () => {
    if (!dismissible) return false;
    onClose();
    return true;
  });
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
          ref={setContent}
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
            "dialog-in fixed inset-x-0 bottom-0 z-[70] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-xl border border-line-strong bg-surface shadow-pop md:inset-x-auto md:bottom-auto md:left-1/2 md:top-[12vh] md:max-h-[calc(100dvh-12vh-1.5rem)] md:-translate-x-1/2 md:rounded-xl md:[@media(max-height:640px)]:top-[max(3dvh,env(safe-area-inset-top,0px))] md:[@media(max-height:640px)]:max-h-[calc(100dvh-max(3dvh,env(safe-area-inset-top,0px))-1rem)]",
            widths[size ?? "md"],
          )}
        >
          <div className="dlg-head shrink-0 border-b border-line pb-3.5 px-5 max-md:pl-[max(1.25rem,env(safe-area-inset-left,0px))] max-md:pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-3.5">
            {/* Grab handle: a visual cue that this is a sheet, no swipe behind it. */}
            <div
              aria-hidden
              className="mx-auto -mt-1.5 mb-2.5 h-1 w-9 rounded-full bg-line-strong md:hidden"
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <RDialog.Title className="font-cond text-[18px] font-semibold leading-snug [overflow-wrap:anywhere]">
                  {title}
                </RDialog.Title>
                {description ? (
                  <RDialog.Description className="dlg-desc mt-0.5 text-caption text-ink-3">
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
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-4 px-5 max-md:pl-[max(1.25rem,env(safe-area-inset-left,0px))] max-md:pr-[max(1.25rem,env(safe-area-inset-right,0px))]">
            {children}
          </div>
          {actions ? (
            <div className="sheet-foot flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] px-5 max-md:pl-[max(1.25rem,env(safe-area-inset-left,0px))] max-md:pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-3 md:flex-row md:flex-wrap md:justify-end md:pb-3">
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
