import { FolderPlus, UploadIcon } from "lucide-react";
import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { usePutObject } from "./hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useBucketContext } from "../context";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createFolderSchema, CreateFolderSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "@/components/ui/input";

type Props = {
  prefix: string;
};

const Actions = ({ prefix }: Props) => {
  const { bucketName } = useBucketContext();
  const queryClient = useQueryClient();

  const putObject = usePutObject(bucketName, {
    onSuccess: () => {
      toast.success("File uploaded");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
    },
    onError: handleError,
  });

  const onUploadFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) {
        return;
      }

      if (files.length > 20) {
        toast.error("You can only upload up to 20 files at a time");
        return;
      }

      for (const file of files) {
        const key = prefix + file.name;
        putObject.mutate({ key, file });
      }
    };

    input.click();
    input.remove();
  };

  return (
    <div className="flex items-center gap-1">
      <CreateFolderAction prefix={prefix} />
      <Button
        size="sm"
        icon={UploadIcon}
        loading={putObject.isPending}
        onClick={onUploadFile}
      >
        Upload
      </Button>
    </div>
  );
};

type CreateFolderActionProps = {
  prefix: string;
};

const CreateFolderAction = ({ prefix }: CreateFolderActionProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { bucketName } = useBucketContext();
  const queryClient = useQueryClient();

  const form = useForm<CreateFolderSchema>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { name: "" },
  });

  const createFolder = usePutObject(bucketName, {
    onSuccess: () => {
      toast.success("Folder created");
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] });
      onClose();
      form.reset();
    },
    onError: handleError,
  });

  const onSubmit = form.handleSubmit((values) => {
    createFolder.mutate({ key: `${prefix}${values.name}/`, file: null });
  });

  return (
    <>
      <Button size="sm" icon={FolderPlus} onClick={onOpen}>
        New folder
      </Button>

      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Create folder"
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="create-folder-form"
              color="primary"
              loading={createFolder.isPending}
            >
              Create folder
            </Button>
          </>
        }
      >
        <form id="create-folder-form" onSubmit={onSubmit}>
          <InputField
            form={form}
            name="name"
            title="Folder name"
            autoComplete="off"
            className="w-full"
          />
        </form>
      </Dialog>
    </>
  );
};

export default Actions;
