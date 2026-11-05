import Button from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRemoveBucket } from "../hooks";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-store";
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
      navigate(PLACES.buckets, { replace: true });
    }
  };

  return (
    <Button variant="danger" icon={Trash} onClick={() => void onRemove()}>
      Delete bucket
    </Button>
  );
};

export default DeleteBucketButton;
