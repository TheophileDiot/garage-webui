import { useStore } from "zustand";
import Button from "./button";
import Dialog from "./dialog";
import { confirmStore, settle } from "./confirm-store";

export const ConfirmHost = () => {
  const { open, title, message, confirmLabel, danger } = useStore(confirmStore);

  return (
    <Dialog
      open={open}
      onClose={() => settle(false)}
      title={title}
      actions={
        <>
          <Button onClick={() => settle(false)}>Cancel</Button>
          <Button
            color={danger ? "error" : "primary"}
            onClick={() => settle(true)}
          >
            {confirmLabel || "Confirm"}
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Dialog>
  );
};
