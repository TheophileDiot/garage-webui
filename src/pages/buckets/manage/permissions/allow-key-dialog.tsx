import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { useKeys } from "@/pages/keys/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { AllowKeysSchema, allowKeysSchema } from "../schema";
import { useDisclosure } from "@/hooks/useDisclosure";
import Checkbox, { CheckboxField } from "@/components/ui/checkbox";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { useAllowKey } from "../hooks";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { handleError } from "@/lib/utils";
import { useBucketContext } from "../context";
import { keyLabel } from "@/pages/keys/utils";

type Props = {
  currentKeys?: string[];
};

type KeyField = "checked" | "read" | "write" | "owner";
type Row = AllowKeysSchema["keys"][number] & { id: string; index: number };

const FORM_ID = "allow-key-form";

const AllowKeyDialog = ({ currentKeys }: Props) => {
  const { bucket } = useBucketContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data: keys, isPending, error, refetch } = useKeys();
  const queryClient = useQueryClient();
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const form = useForm<AllowKeysSchema>({
    resolver: zodResolver(allowKeysSchema),
    defaultValues: { keys: [] },
  });
  const { setValue, getValues } = form;
  const { fields: keyFields } = useFieldArray({
    control: form.control,
    name: "keys",
  });
  const watched = useWatch({ control: form.control, name: "keys" });

  const allowKey = useAllowKey(bucket.id, {
    onSuccess: () => {
      form.reset();
      onClose();
      toast.success("Key allowed");
    },
    onError: (err) => {
      handleError(err);
      // A key may be gone: show the keys Garage really has.
      void queryClient.invalidateQueries({ queryKey: ["keys"] });
    },
  });
  const { reset: resetMutation } = allowKey;

  const currentIds = (currentKeys || []).join(",");

  useEffect(() => {
    const current = currentIds.split(",");
    // Keep what the user already picked for keys that are still listed, so a refresh never drops a selection.
    const picked = new Map(getValues("keys").map((k) => [k.keyId, k]));
    const _keys = keys
      ?.filter((key) => !current.includes(key.id))
      ?.map(
        (key) =>
          picked.get(key.id) ?? {
            checked: false,
            keyId: key.id,
            name: key.name,
            read: false,
            write: false,
            owner: false,
          },
      );

    setValue("keys", _keys || []);
  }, [keys, currentIds, setValue, getValues]);

  const allOn = (field: KeyField) =>
    (watched?.length ?? 0) > 0 && watched.every((item) => item[field]);

  const onToggleAll = (checked: boolean, field: KeyField) => {
    const newValues = getValues("keys").map((item) => ({
      ...item,
      [field]: checked,
    }));
    setValue("keys", newValues);
    if (field === "checked" && checked) setSelectionError(null);
  };

  const close = () => {
    onClose();
    setValue(
      "keys",
      getValues("keys").map((k) => ({
        ...k,
        checked: false,
        read: false,
        write: false,
        owner: false,
      })),
    );
    setSelectionError(null);
    resetMutation();
  };

  const onSubmit = form.handleSubmit((values) => {
    const data = values.keys
      .filter((key) => key.checked)
      .map((key) => ({
        keyId: key.keyId,
        permissions: { read: key.read, write: key.write, owner: key.owner },
      }));
    if (data.length === 0) {
      setSelectionError("Select at least one key.");
      return;
    }
    setSelectionError(null);
    allowKey.mutate(data);
  });

  const rows: Row[] = keyFields.map((f, index) => ({ ...f, index }));

  const columns: LedgerColumn<Row>[] = [
    {
      key: "key",
      header: "Key",
      mobile: "title",
      width: "34%",
      cell: (field) => {
        const label = keyLabel({ name: field.name, accessKeyId: field.keyId });
        return (
          <CheckboxField
            form={form}
            name={`keys.${field.index}.checked`}
            label={label}
            title={field.name || field.keyId}
            className="min-w-0 max-w-full [&>span]:truncate max-md:[&>span]:whitespace-normal max-md:[&>span]:[overflow-wrap:anywhere]"
          />
        );
      },
    },
    {
      key: "aliases",
      header: "Local aliases",
      width: "26%",
      cell: (field) => {
        const curKey = bucket.keys.find((k) => k.accessKeyId === field.keyId);
        return curKey?.bucketLocalAliases?.join(", ") || "None";
      },
    },
    ...(["read", "write", "owner"] as const).map<LedgerColumn<Row>>((perm) => ({
      key: perm,
      header: perm[0].toUpperCase() + perm.slice(1),
      width: "13%",
      cell: (field) => {
        const label = keyLabel({ name: field.name, accessKeyId: field.keyId });
        return (
          <CheckboxField
            form={form}
            name={`keys.${field.index}.${perm}`}
            aria-label={`${perm[0].toUpperCase() + perm.slice(1)} for ${label}`}
          />
        );
      },
    })),
  ];

  return (
    <>
      <Button icon={Plus} size="sm" onClick={onOpen}>
        Allow key
      </Button>

      <Dialog
        open={isOpen}
        onClose={close}
        dismissible={!allowKey.isPending}
        title="Allow keys on this bucket"
        description="Pick the keys and the permissions each one gets."
        size="xl"
        actions={
          <>
            <Button onClick={close} disabled={allowKey.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              loading={allowKey.isPending}
              disabled={keyFields.length === 0}
            >
              Allow selected keys
            </Button>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={onSubmit}>
          {isPending ? (
            <SkeletonRows label="Loading keys" rows={3} />
          ) : error ? (
            <ErrorState
              title="Could not load keys"
              error={error}
              onRetry={() => void refetch()}
              className="px-0 py-4"
            />
          ) : keyFields.length === 0 ? (
            <EmptyState title="No other key available" className="px-0 py-4">
              Every key already has access, or none exists yet.{" "}
              <Link to="/keys" className="xlink" onClick={close}>
                Create a key
              </Link>
              .
            </EmptyState>
          ) : (
            <>
              <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule pb-3">
                <legend className="sr-only">Select all</legend>
                <span className="text-ink-3" aria-hidden>
                  Select all
                </span>
                <Checkbox
                  label="Keys"
                  checked={allOn("checked")}
                  onChange={(e) => onToggleAll(e.target.checked, "checked")}
                />
                <Checkbox
                  label="Read"
                  checked={allOn("read")}
                  onChange={(e) => onToggleAll(e.target.checked, "read")}
                />
                <Checkbox
                  label="Write"
                  checked={allOn("write")}
                  onChange={(e) => onToggleAll(e.target.checked, "write")}
                />
                <Checkbox
                  label="Owner"
                  checked={allOn("owner")}
                  onChange={(e) => onToggleAll(e.target.checked, "owner")}
                />
              </fieldset>
              <div className="-mx-3 max-h-[50vh] overflow-y-auto">
                <Ledger
                  caption="Keys that can be allowed"
                  columns={columns}
                  rows={rows}
                  rowKey={(r) => r.id}
                />
              </div>
            </>
          )}
          {selectionError ? (
            <p role="alert" className="mt-3 text-caption text-bad">
              {selectionError}
            </p>
          ) : null}
          {allowKey.error ? (
            <p
              role="alert"
              className="mt-3 text-caption text-bad [overflow-wrap:anywhere]"
            >
              {allowKey.error.message}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  );
};

export default AllowKeyDialog;
