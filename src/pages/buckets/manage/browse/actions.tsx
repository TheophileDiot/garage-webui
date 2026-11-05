import { FolderPlus, UploadIcon } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import Button from "@/components/ui/button";
import Dialog, { FormActions } from "@/components/ui/dialog";
import { usePutObject } from "./hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { useBucketContext } from "../context";
import { useDisclosure } from "@/hooks/useDisclosure";
import { createFolderSchema, CreateFolderSchema } from "./schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputField } from "@/components/ui/input";

const MAX_FILES = 20;

type Props = {
  prefix: string;
  /** On the phone's title row: 44 px controls, New folder as an icon. */
  compact?: boolean;
};

const Actions = ({ prefix, compact }: Props) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const putObject = usePutObject();

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    if (files.length > MAX_FILES) {
      toast.error(`You can only upload up to ${MAX_FILES} files at a time`);
      return;
    }

    setUploading(true);
    const results = await Promise.allSettled(
      files.map((file) =>
        putObject.mutateAsync({ key: prefix + file.name, file }),
      ),
    );
    setUploading(false);

    const uploaded = results.filter((r) => r.status === "fulfilled").length;
    if (uploaded) {
      toast.success(
        uploaded === 1 ? "File uploaded" : `${uploaded} files uploaded`,
      );
    }
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        toast.error(
          `${files[i].name}: ${(r.reason as Error)?.message || "Upload failed"}`,
        );
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CreateFolderAction prefix={prefix} compact={compact} />
      <input
        ref={fileInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="upload-input"
        onChange={(e) => void onFiles(e)}
      />
      <Button
        variant="primary"
        icon={UploadIcon}
        loading={uploading}
        className={compact ? "h-11" : undefined}
        onClick={() => fileInput.current?.click()}
      >
        Upload
      </Button>
    </div>
  );
};

type CreateFolderActionProps = {
  prefix: string;
  compact?: boolean;
};

const CreateFolderAction = ({ prefix, compact }: CreateFolderActionProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { globalAlias } = useBucketContext();

  const form = useForm<CreateFolderSchema>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { name: "" },
  });

  const createFolder = usePutObject({
    onSuccess: () => {
      toast.success("Folder created");
      close();
    },
    onError: handleError,
  });

  const close = () => {
    onClose();
    form.reset();
  };

  const onSubmit = form.handleSubmit((values) => {
    createFolder.mutate({ key: `${prefix}${values.name}/`, file: null });
  });

  return (
    <>
      {compact ? (
        <Button
          icon={FolderPlus}
          aria-label="New folder"
          title="New folder"
          className="h-11 w-11"
          onClick={onOpen}
        />
      ) : (
        <Button icon={FolderPlus} onClick={onOpen}>
          New folder
        </Button>
      )}

      <Dialog
        open={isOpen}
        onClose={close}
        title="New folder"
        description="S3 has no real folders: this creates an empty key ending in a slash."
        dismissible={!createFolder.isPending}
        actions={
          <FormActions
            onCancel={close}
            pending={createFolder.isPending}
            formId="create-folder-form"
            submitLabel="Create folder"
          />
        }
      >
        <form id="create-folder-form" onSubmit={onSubmit}>
          <InputField
            form={form}
            name="name"
            title="Folder name"
            hint={
              <>
                Created under{" "}
                <span className="[overflow-wrap:anywhere]">
                  {globalAlias}/{prefix}
                </span>
              </>
            }
            autoComplete="off"
            spellCheck={false}
            className="w-full"
          />
        </form>
      </Dialog>
    </>
  );
};

export default Actions;
