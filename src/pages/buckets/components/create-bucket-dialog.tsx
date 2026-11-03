import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createBucketSchema, CreateBucketSchema } from "../schema";
import { InputField } from "@/components/ui/input";
import { useCreateBucket } from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { handleError } from "@/lib/utils";
import { toast } from "sonner";

const CreateBucketDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<CreateBucketSchema>({
    resolver: zodResolver(createBucketSchema),
    defaultValues: { globalAlias: "" },
  });
  const queryClient = useQueryClient();

  const createBucket = useCreateBucket({
    onSuccess: () => {
      form.reset();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["buckets"] });
      toast.success("Bucket created");
    },
    onError: handleError,
  });

  const onSubmit = form.handleSubmit((values) => {
    createBucket.mutate(values);
  });

  return (
    <>
      <Button icon={Plus} color="primary" onClick={onOpen}>
        Create bucket
      </Button>

      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Create bucket"
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="create-bucket-form"
              color="primary"
              loading={createBucket.isPending}
            >
              Create bucket
            </Button>
          </>
        }
      >
        <p className="muted text-sm">
          The name becomes the global alias clients use to reach the bucket.
        </p>
        <form id="create-bucket-form" onSubmit={onSubmit} className="mt-4">
          <InputField
            form={form}
            name="globalAlias"
            title="Bucket name"
            autoComplete="off"
            autoFocus
            className="w-full"
          />
        </form>
      </Dialog>
    </>
  );
};

export default CreateBucketDialog;
