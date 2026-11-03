import Button from "@/components/ui/button";
import Dialog from "@/components/ui/dialog";
import { useKeys } from "@/pages/keys/hooks";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { AllowKeysSchema, allowKeysSchema } from "../schema";
import { useDisclosure } from "@/hooks/useDisclosure";
import Checkbox, { CheckboxField } from "@/components/ui/checkbox";
import { useAllowKey } from "../hooks";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useBucketContext } from "../context";

type Props = {
  currentKeys?: string[];
};

type KeyField = "checked" | "read" | "write" | "owner";

const AllowKeyDialog = ({ currentKeys }: Props) => {
  const { bucket } = useBucketContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { data: keys } = useKeys();
  const form = useForm<AllowKeysSchema>({
    resolver: zodResolver(allowKeysSchema),
    defaultValues: { keys: [] },
  });
  const { setValue, getValues } = form;
  const { fields: keyFields } = useFieldArray({
    control: form.control,
    name: "keys",
  });
  const queryClient = useQueryClient();

  const allowKey = useAllowKey(bucket.id, {
    onSuccess: () => {
      form.reset();
      onClose();
      toast.success("Key allowed");
      queryClient.invalidateQueries({ queryKey: ["bucket", bucket.id] });
    },
    onError: handleError,
  });

  const currentIds = (currentKeys || []).join(",");

  useEffect(() => {
    const current = currentIds.split(",");
    const _keys = keys
      ?.filter((key) => !current.includes(key.id))
      ?.map((key) => ({
        checked: false,
        keyId: key.id,
        name: key.name,
        read: false,
        write: false,
        owner: false,
      }));

    setValue("keys", _keys || []);
  }, [keys, currentIds, setValue]);

  const onToggleAll = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: KeyField,
  ) => {
    const newValues = getValues("keys").map((item) => ({
      ...item,
      [field]: e.target.checked,
    }));
    setValue("keys", newValues);
  };

  const onSubmit = form.handleSubmit((values) => {
    const data = values.keys
      .filter((key) => key.checked)
      .map((key) => ({
        keyId: key.keyId,
        permissions: { read: key.read, write: key.write, owner: key.owner },
      }));
    if (data.length === 0) {
      toast.error("Select at least one key");
      return;
    }
    allowKey.mutate(data);
  });

  return (
    <>
      <Button icon={Plus} color="primary" onClick={onOpen}>
        Allow key
      </Button>

      <Dialog
        open={isOpen}
        onClose={onClose}
        title="Allow keys on this bucket"
        className="max-w-3xl"
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="allow-key-form"
              color="primary"
              loading={allowKey.isPending}
            >
              Allow selected keys
            </Button>
          </>
        }
      >
        <form id="allow-key-form" onSubmit={onSubmit}>
          <p className="muted text-sm">
            Pick the keys and the permissions each one gets.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">
                    <Checkbox
                      label="Key"
                      onChange={(e) => onToggleAll(e, "checked")}
                    />
                  </th>
                  <th scope="col">Local aliases</th>
                  <th scope="col" className="text-center">
                    <Checkbox
                      label="Read"
                      className="justify-center"
                      onChange={(e) => onToggleAll(e, "read")}
                    />
                  </th>
                  <th scope="col" className="text-center">
                    <Checkbox
                      label="Write"
                      className="justify-center"
                      onChange={(e) => onToggleAll(e, "write")}
                    />
                  </th>
                  <th scope="col" className="text-center">
                    <Checkbox
                      label="Owner"
                      className="justify-center"
                      onChange={(e) => onToggleAll(e, "owner")}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {!keyFields.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-base-content/70"
                    >
                      No other key available. Create a key first.
                    </td>
                  </tr>
                ) : null}
                {keyFields.map((field, index) => {
                  const curKey = bucket.keys.find(
                    (key) => key.accessKeyId === field.keyId,
                  );
                  const label = field.name || field.keyId?.substring(0, 8);
                  return (
                    <tr key={field.id}>
                      <td>
                        <CheckboxField
                          form={form}
                          name={`keys.${index}.checked`}
                          label={label}
                        />
                      </td>
                      <td>
                        {curKey?.bucketLocalAliases?.join(", ") || "None"}
                      </td>
                      <td className="text-center">
                        <CheckboxField
                          form={form}
                          name={`keys.${index}.read`}
                          aria-label={`Read for ${label}`}
                          className="justify-center"
                        />
                      </td>
                      <td className="text-center">
                        <CheckboxField
                          form={form}
                          name={`keys.${index}.write`}
                          aria-label={`Write for ${label}`}
                          className="justify-center"
                        />
                      </td>
                      <td className="text-center">
                        <CheckboxField
                          form={form}
                          name={`keys.${index}.owner`}
                          aria-label={`Owner for ${label}`}
                          className="justify-center"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      </Dialog>
    </>
  );
};

export default AllowKeyDialog;
