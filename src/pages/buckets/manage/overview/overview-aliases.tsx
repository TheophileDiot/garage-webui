import { Plus } from "lucide-react";
import Chips from "@/components/ui/chips";
import Dialog from "@/components/ui/dialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddAliasSchema, addAliasSchema } from "../schema";
import Button from "@/components/ui/button";
import { useAddAlias, useRemoveAlias } from "../hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { InputField } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useBucketContext } from "../context";
import { confirmAction } from "@/components/ui/confirm-store";

const AliasesSection = () => {
  const { bucket: data } = useBucketContext();

  const queryClient = useQueryClient();
  const removeAlias = useRemoveAlias(data?.id, {
    onSuccess: () => {
      toast.success("Alias removed");
      queryClient.invalidateQueries({ queryKey: ["bucket", data?.id] });
    },
    onError: handleError,
  });

  const onRemoveAlias = async (alias: string) => {
    const ok = await confirmAction({
      title: "Remove alias",
      message: `Remove the alias ${alias}? Clients using this name will no longer reach the bucket.`,
      confirmLabel: "Remove alias",
      danger: true,
    });
    if (ok) removeAlias.mutate(alias);
  };

  const aliases = data?.globalAliases || [];

  return (
    <div>
      <h3 className="title">Aliases</h3>
      <p className="muted mt-1 text-sm">
        Global names clients use to reach this bucket.
      </p>

      <div className="mt-3 flex flex-row flex-wrap items-center gap-2">
        {aliases.map((alias: string) => (
          <Chips
            key={alias}
            onRemove={() => onRemoveAlias(alias)}
            removeLabel={`Remove alias ${alias}`}
          >
            <span className="mono">{alias}</span>
          </Chips>
        ))}
        {aliases.length === 0 ? (
          <p className="text-sm text-base-content/70">No global alias.</p>
        ) : null}
        <AddAliasDialog id={data?.id} />
      </div>
    </div>
  );
};

const AddAliasDialog = ({ id }: { id?: string }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<AddAliasSchema>({
    resolver: zodResolver(addAliasSchema),
    defaultValues: { alias: "" },
  });
  const queryClient = useQueryClient();

  const addAlias = useAddAlias(id, {
    onSuccess: () => {
      form.reset();
      onClose();
      toast.success("Alias added");
      queryClient.invalidateQueries({ queryKey: ["bucket", id] });
    },
    onError: handleError,
  });

  const onSubmit = form.handleSubmit((values) => {
    addAlias.mutate(values.alias);
  });

  return (
    <>
      <Button size="sm" onClick={onOpen} icon={Plus}>
        Add alias
      </Button>

      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Add alias"
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="add-alias-form"
              color="primary"
              loading={addAlias.isPending}
            >
              Add alias
            </Button>
          </>
        }
      >
        <form id="add-alias-form" onSubmit={onSubmit}>
          <InputField
            form={form}
            name="alias"
            title="Alias name"
            autoComplete="off"
            className="w-full"
          />
        </form>
      </Dialog>
    </>
  );
};

export default AliasesSection;
