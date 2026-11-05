import Button from "@/components/ui/button";
import Dialog, { FormActions } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createKeySchema, CreateKeySchema } from "../schema";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import { useCreateKey } from "../hooks";
import { handleError } from "@/lib/utils";
import { toast } from "sonner";

const CreateKeyDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<CreateKeySchema>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "" },
  });
  const isImport = useWatch({ control: form.control, name: "isImport" });

  const close = () => {
    onClose();
    form.reset({ name: "" });
  };

  const createKey = useCreateKey({
    onSuccess: () => {
      close();
      toast.success(isImport ? "Key imported" : "Key created");
    },
    onError: handleError,
  });

  const open = () => {
    form.reset({ name: "" });
    createKey.reset();
    onOpen();
  };

  const onSubmit = form.handleSubmit((values) => {
    createKey.mutate(values);
  });

  return (
    <>
      <Button variant="primary" icon={Plus} onClick={open}>
        Create key
      </Button>

      <Dialog
        open={isOpen}
        onClose={close}
        dismissible={!createKey.isPending}
        title={isImport ? "Import access key" : "Create access key"}
        description="A key starts with no access. Allow it on a bucket afterwards."
        actions={
          <FormActions
            onCancel={close}
            pending={createKey.isPending}
            formId="create-key-form"
            submitLabel={isImport ? "Import key" : "Create key"}
          />
        }
      >
        <form id="create-key-form" onSubmit={onSubmit} className="grid gap-4">
          <InputField
            form={form}
            name="name"
            title="Key name"
            hint="Letters, digits, - and _. The name is only a label."
            autoComplete="off"
            spellCheck={false}
          />
          <ToggleField
            form={form}
            name="isImport"
            label="Import an existing key"
            description="Bring a key pair from another Garage or S3 client."
          />

          {isImport && (
            <>
              <InputField
                form={form}
                name="accessKeyId"
                title="Access key ID"
                inputClassName="font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <InputField
                form={form}
                name="secretAccessKey"
                title="Secret access key"
                inputClassName="font-mono"
                type="password"
                autoComplete="off"
              />
            </>
          )}
        </form>
      </Dialog>
    </>
  );
};

export default CreateKeyDialog;
