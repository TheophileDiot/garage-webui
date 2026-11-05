import Button from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRemoveBucket } from "../hooks";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-store";
import { afterSheetsClosed } from "@/components/ui/use-sheet-back";
import { PLACES } from "@/lib/routes";

/** Deletes the bucket. The dialog stays open with Garage's message when the bucket is not empty. */
const DeleteBucketButton = ({ id, name }: { id: string; name: string }) => {
  const navigate = useNavigate();
  const removeBucket = useRemoveBucket();

  const onRemove = async () => {
    const ok = await confirmAction({
      title: "Delete bucket",
      message: `Delete ${name}? Garage only deletes empty buckets, and its aliases are released.`,
      confirmLabel: "Delete bucket",
      danger: true,
      action: () => removeBucket.mutateAsync(id),
    });
    if (ok) {
      toast.success("Bucket deleted");
      // The confirmation sheet's history entry goes first, or the replace would leave the deleted bucket's page behind it.
      afterSheetsClosed(() => navigate(PLACES.buckets, { replace: true }));
    }
  };

  return (
    <Button variant="danger" icon={Trash} onClick={() => void onRemove()}>
      Delete bucket
    </Button>
  );
};

export default DeleteBucketButton;
