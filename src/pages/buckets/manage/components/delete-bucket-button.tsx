import Button from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRemoveBucket } from "../hooks";
import { toast } from "sonner";
import { confirmAction } from "@/components/ui/confirm-store";

/** Deletes the bucket. The dialog stays open with Garage's message when the bucket is not empty. */
const DeleteBucketButton = ({ id, name }: { id: string; name: string }) => {
  const navigate = useNavigate();
  const removeBucket = useRemoveBucket();

  const onRemove = async () => {
    const ok = await confirmAction({
      title: "Remove bucket",
      message: `Remove ${name}? Garage only deletes empty buckets, and its aliases are released.`,
      confirmLabel: "Remove bucket",
      danger: true,
      action: () => removeBucket.mutateAsync(id),
    });
    if (ok) {
      toast.success("Bucket removed");
      navigate("/buckets", { replace: true });
    }
  };

  return (
    <Button variant="danger" icon={Trash} onClick={() => void onRemove()}>
      Remove bucket
    </Button>
  );
};

export default DeleteBucketButton;
