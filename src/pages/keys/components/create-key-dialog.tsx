import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createKeySchema, CreateKeySchema } from "../schema";
import { InputField } from "@/components/ui/input";
import { CheckboxField } from "@/components/ui/checkbox";
import { useCreateKey } from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { handleError } from "@/lib/utils";
import { toast } from "sonner";

const CreateKeyDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<CreateKeySchema>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "" },
  });
  const isImport = useWatch({ control: form.control, name: "isImport" });
  const queryClient = useQueryClient();

  const createKey = useCreateKey({
    onSuccess: () => {
      form.reset({ name: "" });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["keys"] });
      toast.success("Key created");
    },
    onError: handleError,
  });

  const onSubmit = form.handleSubmit((values) => {
    createKey.mutate(values);
  });

  return (
    <>
      <Button icon={Plus} color="primary" onClick={onOpen}>
        Create key
      </Button>

      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Create access key"
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="create-key-form"
              color="primary"
              loading={createKey.isPending}
            >
              {isImport ? "Import key" : "Create key"}
            </Button>
          </>
        }
      >
        <form id="create-key-form" onSubmit={onSubmit} className="space-y-1">
          <InputField
            form={form}
            name="name"
            title="Key name"
            autoComplete="off"
            className="w-full"
          />
          <CheckboxField
            form={form}
            name="isImport"
            label="Import an existing key"
            className="mt-2"
          />

          {isImport && (
            <>
              <InputField
                form={form}
                name="accessKeyId"
                title="Access key ID"
                autoComplete="off"
                className="w-full"
              />
              <InputField
                form={form}
                name="secretAccessKey"
                title="Secret access key"
                type="password"
                autoComplete="off"
                className="w-full"
              />
            </>
          )}
        </form>
      </Dialog>
    </>
  );
};

export default CreateKeyDialog;
