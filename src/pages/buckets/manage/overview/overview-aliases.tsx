import { Plus, X } from "lucide-react";
import Dialog from "@/components/ui/dialog";
import { useDisclosure } from "@/hooks/useDisclosure";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddAliasSchema, addAliasSchema } from "../schema";
import Button from "@/components/ui/button";
import IconButton from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/page-header";
import { useAddAlias, useRemoveAlias } from "../hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { InputField } from "@/components/ui/input";
import { useBucketContext } from "../context";
import { confirmAction } from "@/components/ui/confirm-store";
import { localAliasesOf } from "../../utils";

const AliasesSection = () => {
  const { bucket: data } = useBucketContext();

  const removeAlias = useRemoveAlias(data?.id);

  const onRemoveAlias = async (alias: string) => {
    const ok = await confirmAction({
      title: "Remove alias",
      message: `Remove the alias ${alias}? Clients using this name will no longer reach the bucket.`,
      confirmLabel: "Remove alias",
      danger: true,
      action: () => removeAlias.mutateAsync(alias),
    });
    if (ok) toast.success("Alias removed");
  };

  const aliases = data?.globalAliases || [];
  const locals = localAliasesOf(data);

  return (
    <Panel
      id="aliases"
      title="Aliases"
      aside={
        <>
          {aliases.length} global, {locals.length} local
        </>
      }
    >
      <h3 className="sr-only">Global aliases</h3>
      {aliases.length === 0 ? (
        <p className="text-ink-3">
          No global alias. Add one to browse objects and serve a website.
        </p>
      ) : (
        <ul className="grid gap-1">
          {aliases.map((alias: string) => (
            <li
              key={alias}
              className="flex min-h-8 items-center justify-between gap-2"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <span className="text-ink-3">s3://</span>
                {alias}
              </span>
              <IconButton
                label={`Remove alias ${alias}`}
                icon={X}
                variant="ghost-danger"
                onClick={() => void onRemoveAlias(alias)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-3">
        <p className="text-ink-3">
          Global names clients use to reach this bucket.
        </p>
        <AddAliasDialog id={data?.id} />
      </div>

      {locals.length > 0 ? (
        <div className="mt-3 border-t border-rule pt-3">
          <h3 className="font-medium">Local aliases</h3>
          <p className="mt-0.5 text-ink-3">
            Names a single key uses for this bucket. Managed on the key, listed
            here.
          </p>
          <ul className="mt-2 grid gap-1">
            {locals.map((l) => (
              <li
                key={`${l.accessKeyId}-${l.alias}`}
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                {l.alias}{" "}
                <span className="text-ink-3">
                  on key {l.keyName || l.accessKeyId}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
};

const FORM_ID = "add-alias-form";

const AddAliasDialog = ({ id }: { id?: string }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const form = useForm<AddAliasSchema>({
    resolver: zodResolver(addAliasSchema),
    defaultValues: { alias: "" },
  });

  const addAlias = useAddAlias(id, {
    onSuccess: () => {
      form.reset();
      onClose();
      toast.success("Alias added");
    },
    onError: handleError,
  });
  const { reset: resetMutation } = addAlias;

  const onSubmit = form.handleSubmit((values) => {
    addAlias.mutate(values.alias);
  });

  const close = () => {
    onClose();
    form.reset();
    resetMutation();
  };

  return (
    <>
      <Button size="sm" onClick={onOpen} icon={Plus}>
        Add alias
      </Button>

      <Dialog
        open={isOpen}
        onClose={close}
        dismissible={!addAlias.isPending}
        title="Add alias"
        description="Another global name for this bucket. Garage rejects a name that is taken or not valid."
        actions={
          <>
            <Button onClick={close} disabled={addAlias.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              loading={addAlias.isPending}
            >
              Add alias
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit}>
          <InputField
            form={form}
            name="alias"
            title="Alias name"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full"
          />
        </form>
        {addAlias.error ? (
          <p
            role="alert"
            className="mt-3 text-caption text-bad [overflow-wrap:anywhere]"
          >
            {addAlias.error.message}
          </p>
        ) : null}
      </Dialog>
    </>
  );
};

export default AliasesSection;
