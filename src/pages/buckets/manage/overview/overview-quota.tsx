import { DeepPartial, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QuotaSchema, quotaSchema } from "../schema";
import { useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useUpdateBucket } from "../hooks";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import { Panel } from "@/components/ui/page-header";
import { useBucketContext } from "../context";
import { handleError } from "@/lib/utils";
import { quotaValue } from "../../utils";
import SaveState from "./save-state";
import {
  markEdited,
  markSent,
  markSettled,
  newAutosave,
  shouldReset,
} from "./autosave";

const GIB = 1024 ** 3;

/** What the server stores for a form state, as one comparable string. */
const keyOf = (
  id: string | undefined,
  maxObjects: number | null,
  maxSize: number | null,
) => `${id}|${maxObjects ?? "-"}|${maxSize ?? "-"}`;

const QuotaSection = () => {
  const { bucket: data } = useBucketContext();

  const form = useForm<QuotaSchema>({
    resolver: zodResolver(quotaSchema),
  });
  const { reset, watch } = form;
  const isEnabled = useWatch({ control: form.control, name: "enabled" });

  const updateMutation = useUpdateBucket(data?.id);
  const { mutateAsync } = updateMutation;
  // Stale or echoing refetches must not reset what the user is typing or has saved since (see autosave.ts).
  const autosave = useRef(newAutosave());

  const onChange = useDebounce((values: DeepPartial<QuotaSchema>) => {
    const { enabled } = values;
    const maxObjects = Number(values.maxObjects);
    const maxSize = Math.round(Number(values.maxSize) * GIB);

    const quotas = {
      maxObjects: enabled && maxObjects > 0 ? maxObjects : null,
      maxSize: enabled && maxSize > 0 ? maxSize : null,
    };
    markSent(
      autosave.current,
      keyOf(data?.id, quotas.maxObjects, quotas.maxSize),
    );
    // mutateAsync, not mutate: per-call callbacks only fire for the latest call, which would leak the in-flight count.
    mutateAsync({ quotas })
      .catch(handleError)
      .finally(() => markSettled(autosave.current));
  });

  const serverObjects = quotaValue(data?.quotas?.maxObjects);
  const serverSize = quotaValue(data?.quotas?.maxSize);

  useEffect(() => {
    if (
      shouldReset(autosave.current, keyOf(data?.id, serverObjects, serverSize))
    ) {
      reset({
        enabled: serverSize != null || serverObjects != null,
        maxSize: serverSize ? serverSize / GIB : null,
        maxObjects: serverObjects,
      });
    }

    const { unsubscribe } = watch((values) => {
      markEdited(autosave.current);
      onChange(values);
    });
    return unsubscribe;
  }, [data?.id, serverObjects, serverSize, reset, watch, onChange]);

  return (
    <Panel
      id="quotas"
      title="Quotas"
      aside={<SaveState mutation={updateMutation} />}
    >
      <p className="text-ink-3">
        Limit how much this bucket can hold. Changes save automatically.
      </p>
      <ToggleField
        form={form}
        name="enabled"
        label="Enforce quotas"
        className="mt-3"
      />

      {isEnabled && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-rule pt-4 md:grid-cols-2">
          <InputField
            form={form}
            name="maxObjects"
            title="Max objects"
            type="number"
            min={0}
            step={1}
          />
          <InputField
            form={form}
            name="maxSize"
            title="Max size (GiB)"
            type="number"
            min={0}
            step="any"
          />
        </div>
      )}
    </Panel>
  );
};

export default QuotaSection;
