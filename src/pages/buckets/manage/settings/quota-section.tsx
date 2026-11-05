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
import { handleError, readableBytes } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";
import { Meter } from "@/components/ui/status";
import { quotaPercent, quotaTone, quotaUses, quotaValue } from "../../utils";
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

  const uses = quotaUses(data);
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
      meta={<SaveState mutation={updateMutation} />}
    >
      <p className="text-ink-3">
        Limit how much this bucket can hold. Changes save automatically.
      </p>

      <div className="mt-3 grid gap-3 rounded border border-line bg-surface-2 p-3">
        {(["size", "objects"] as const).map((kind) => {
          const use = uses.find((q) => q.kind === kind);
          const title = kind === "size" ? "Size quota" : "Object quota";
          if (!use)
            return (
              <div key={kind}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-ink-2">No limit</p>
                </div>
                {kind === "size" ? (
                  <p className="mt-1 text-ink-3">
                    Writes are limited only by cluster disk.
                  </p>
                ) : null}
              </div>
            );
          const tone = quotaTone(use.ratio);
          return (
            <div key={kind}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{title}</h3>
                <p className="tabular-nums text-ink-2">
                  {kind === "size"
                    ? `${readableBytes(use.used)} of ${readableBytes(use.max)}`
                    : `${use.used.toLocaleString()} of ${use.max.toLocaleString()}`}
                </p>
              </div>
              <Meter
                className="mt-2"
                compact
                value={use.used}
                max={use.max}
                tone={tone}
                label={`${title} used`}
              />
              <p
                className={
                  tone === "ink"
                    ? "mt-1.5 text-ink-3"
                    : "mt-1.5 flex items-center gap-1.5 font-medium text-warn"
                }
              >
                {tone !== "ink" ? (
                  <TriangleAlert size={14} aria-hidden className="shrink-0" />
                ) : null}
                {quotaPercent(use)}% used
                {kind === "size"
                  ? `, ${readableBytes(Math.max(0, use.max - use.used))} left`
                  : ""}
              </p>
            </div>
          );
        })}
      </div>

      <ToggleField
        form={form}
        name="enabled"
        label="Enforce quotas"
        className="mt-4"
      />

      {isEnabled && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-line pt-4 md:grid-cols-2">
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
