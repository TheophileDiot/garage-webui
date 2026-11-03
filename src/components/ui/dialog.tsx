import { cn } from "@/lib/utils";
import { PropsWithChildren, ReactNode, useEffect, useId, useRef } from "react";

type Props = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}>;

/** Native modal <dialog>: focus trap, Escape and backdrop click come from the platform. */
const Dialog = ({
  open,
  onClose,
  title,
  actions,
  className,
  children,
}: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn("modal-box max-w-lg", className)}>
        <h2 id={titleId} className="title mb-4">
          {title}
        </h2>
        {children}
        {actions ? <div className="modal-action">{actions}</div> : null}
      </div>
    </dialog>
  );
};

export default Dialog;
