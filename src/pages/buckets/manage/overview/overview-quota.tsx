import { DeepPartial, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QuotaSchema, quotaSchema } from "../schema";
import { useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useUpdateBucket } from "../hooks";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import { useBucketContext } from "../context";
import { handleError } from "@/lib/utils";
import SaveState from "./save-state";

const QuotaSection = () => {
  const { bucket: data } = useBucketContext();

  const form = useForm<QuotaSchema>({
    resolver: zodResolver(quotaSchema),
  });
  const { reset, watch } = form;
  const isEnabled = useWatch({ control: form.control, name: "enabled" });

  const updateMutation = useUpdateBucket(data?.id);
  const { mutate } = updateMutation;

  const onChange = useDebounce((values: DeepPartial<QuotaSchema>) => {
    const { enabled } = values;
    const maxObjects = Number(values.maxObjects);
    const maxSize = Math.round(Number(values.maxSize) * 1024 ** 3);

    mutate(
      {
        quotas: {
          maxObjects: enabled && maxObjects > 0 ? maxObjects : null,
          maxSize: enabled && maxSize > 0 ? maxSize : null,
        },
      },
      { onError: handleError },
    );
  });

  useEffect(() => {
    reset({
      enabled:
        data?.quotas?.maxSize != null || data?.quotas?.maxObjects != null,
      maxSize: data?.quotas?.maxSize ? data.quotas.maxSize / 1024 ** 3 : null,
      maxObjects: data?.quotas?.maxObjects || null,
    });

    const { unsubscribe } = watch((values) => onChange(values));
    return unsubscribe;
  }, [data, reset, watch, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h3 className="title">Quotas</h3>
        <SaveState mutation={updateMutation} />
      </div>
      <p className="muted mt-1 text-sm">
        Limit how much a bucket can hold. Changes save automatically.
      </p>
      <ToggleField
        form={form}
        name="enabled"
        label="Enforce quotas"
        className="mt-3"
      />

      {isEnabled && (
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            form={form}
            name="maxObjects"
            title="Max objects"
            type="number"
            min={0}
          />
          <InputField
            form={form}
            name="maxSize"
            title="Max size (GiB)"
            type="number"
            min={0}
          />
        </div>
      )}
    </div>
  );
};

export default QuotaSection;
