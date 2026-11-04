import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createBucketSchema, CreateBucketSchema } from "../schema";
import { InputField } from "@/components/ui/input";
import { useCreateBucket } from "../hooks";
import { handleError } from "@/lib/utils";
import { toast } from "sonner";

const FORM_ID = "create-bucket-form";

const CreateBucketDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<CreateBucketSchema>({
    resolver: zodResolver(createBucketSchema),
    defaultValues: { globalAlias: "" },
  });

  const createBucket = useCreateBucket({
    onSuccess: () => {
      form.reset();
      onClose();
      toast.success("Bucket created");
    },
    onError: handleError,
  });
  const { reset: resetMutation } = createBucket;

  const onSubmit = form.handleSubmit((values) => {
    createBucket.mutate(values);
  });

  const close = () => {
    onClose();
    form.reset();
    resetMutation();
  };

  return (
    <>
      <Button icon={Plus} variant="primary" onClick={onOpen}>
        Create bucket
      </Button>

      <Dialog
        open={isOpen}
        onClose={close}
        dismissible={!createBucket.isPending}
        title="Create bucket"
        description="A bucket is a flat namespace. The name becomes its global alias, the address clients use."
        actions={
          <>
            <Button onClick={close} disabled={createBucket.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              loading={createBucket.isPending}
            >
              Create bucket
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit}>
          <InputField
            form={form}
            name="globalAlias"
            title="Bucket name"
            hint="3 to 63 characters: lower-case letters, digits, dots and hyphens. Garage checks the name."
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full"
          />
        </form>
        {createBucket.error ? (
          <p
            role="alert"
            className="mt-3 text-caption text-bad [overflow-wrap:anywhere]"
          >
            {createBucket.error.message}
          </p>
        ) : null}
      </Dialog>
    </>
  );
};

export default CreateBucketDialog;
