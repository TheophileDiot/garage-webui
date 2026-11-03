import Button from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useRemoveBucket } from "../hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { confirmAction } from "@/components/ui/confirm-store";

const MenuButton = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const removeBucket = useRemoveBucket({
    onSuccess: () => {
      toast.success("Bucket removed");
      navigate("/buckets", { replace: true });
    },
    onError: handleError,
  });

  const onRemove = async () => {
    const ok = await confirmAction({
      title: "Remove bucket",
      message:
        "Remove this bucket? Garage only deletes empty buckets, and its aliases are released.",
      confirmLabel: "Remove bucket",
      danger: true,
    });
    if (ok && id) removeBucket.mutate(id);
  };

  return (
    <Button
      color="ghost"
      className="text-error hover:bg-error/10"
      icon={Trash}
      loading={removeBucket.isPending}
      onClick={onRemove}
    >
      <span className="hidden sm:inline">Remove bucket</span>
      <span className="sr-only sm:hidden">Remove bucket</span>
    </Button>
  );
};

export default MenuButton;
