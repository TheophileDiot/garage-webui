import { useStore } from "zustand";
import Button from "./button";
import Dialog from "./dialog";
import { confirmStore, runConfirm, settle } from "./confirm-store";

export const ConfirmHost = () => {
  const { open, title, message, confirmLabel, danger, pending, error } =
    useStore(confirmStore);

  return (
    <Dialog
      open={open}
      onClose={() => settle(false)}
      dismissible={!pending}
      title={title}
      size="sm"
      actions={
        <>
          <Button disabled={pending} onClick={() => settle(false)}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={pending}
            onClick={() => void runConfirm()}
          >
            {confirmLabel || "Confirm"}
          </Button>
        </>
      }
    >
      <p className="text-ink-2 [text-wrap:pretty]">{message}</p>
      {error ? (
        <p role="alert" className="mt-3 text-bad [overflow-wrap:anywhere]">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
};
