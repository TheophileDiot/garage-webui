import { DeepPartial, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { websiteConfigSchema, WebsiteConfigSchema } from "../schema";
import { useEffect, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useUpdateBucket } from "../hooks";
import { useConfig } from "@/hooks/useConfig";
import { ExternalLink, Info } from "lucide-react";
import {
  buttonBase,
  buttonSizes,
  buttonVariants,
} from "@/components/ui/button-styles";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import { Panel } from "@/components/ui/page-header";
import { useBucketContext } from "../context";
import { cn, handleError } from "@/lib/utils";
import SaveState from "./save-state";
import {
  markEdited,
  markSent,
  markSettled,
  newAutosave,
  shouldReset,
} from "./autosave";

const DOCS_URL =
  "https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites";

/** What the server stores for a form state, as one comparable string. */
const keyOf = (
  id: string | undefined,
  enabled: boolean | undefined,
  index?: string,
  error?: string,
) => (enabled ? `${id}|on|${index}|${error}` : `${id}|off`);

const WebsiteAccessSection = () => {
  const { bucket: data, bucketName } = useBucketContext();
  const { data: config } = useConfig();
  const form = useForm<WebsiteConfigSchema>({
    resolver: zodResolver(websiteConfigSchema),
  });
  const { reset, watch } = form;
  const isEnabled = useWatch({ control: form.control, name: "websiteAccess" });

  const websitePort = config?.s3_web?.bind_addr?.split(":").pop() || "80";
  const rootDomain = config?.s3_web?.root_domain;

  const updateMutation = useUpdateBucket(data?.id);
  const { mutateAsync } = updateMutation;
  // Stale or echoing refetches must not reset what the user is typing or has saved since (see autosave.ts).
  const autosave = useRef(newAutosave());

  const onChange = useDebounce((values: DeepPartial<WebsiteConfigSchema>) => {
    markSent(
      autosave.current,
      keyOf(
        data?.id,
        values.websiteAccess,
        values.websiteConfig?.indexDocument,
        values.websiteConfig?.errorDocument,
      ),
    );
    // mutateAsync, not mutate: per-call callbacks only fire for the latest call, which would leak the in-flight count.
    mutateAsync({
      websiteAccess: {
        enabled: values.websiteAccess,
        indexDocument: values.websiteAccess
          ? values.websiteConfig?.indexDocument
          : undefined,
        errorDocument: values.websiteAccess
          ? values.websiteConfig?.errorDocument
          : undefined,
      },
    })
      .catch(handleError)
      .finally(() => markSettled(autosave.current));
  });

  const serverEnabled = data?.websiteAccess;
  const serverIndex = data?.websiteConfig?.indexDocument || "index.html";
  const serverError = data?.websiteConfig?.errorDocument || "error/400.html";

  useEffect(() => {
    if (
      shouldReset(
        autosave.current,
        keyOf(data?.id, serverEnabled, serverIndex, serverError),
      )
    ) {
      reset({
        websiteAccess: serverEnabled,
        websiteConfig: {
          indexDocument: serverIndex,
          errorDocument: serverError,
        },
      });
    }

    const { unsubscribe } = watch((values) => {
      markEdited(autosave.current);
      onChange(values);
    });
    return unsubscribe;
  }, [
    data?.id,
    serverEnabled,
    serverIndex,
    serverError,
    reset,
    watch,
    onChange,
  ]);

  // Website hosts are built on the first global alias; a bucket without one has no website address.
  const links = bucketName
    ? [
        `${bucketName}`,
        ...(rootDomain
          ? [
              `${bucketName}${rootDomain}`,
              `${bucketName}${rootDomain}:${websitePort}`,
            ]
          : []),
      ]
    : [];

  return (
    <Panel
      id="website"
      title="Website access"
      aside={
        <span className="inline-flex items-center gap-1">
          <SaveState mutation={updateMutation} />
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website hosting documentation (opens in a new tab)"
            title="Website hosting documentation (opens in a new tab)"
            className={cn(
              buttonBase,
              buttonSizes.sm.icon,
              buttonVariants.ghost,
            )}
          >
            <Info size={15} aria-hidden />
          </a>
        </span>
      }
    >
      <ToggleField
        form={form}
        name="websiteAccess"
        label="Serve as a website"
      />
      <p className="mt-1 text-ink-3">
        Serve the bucket as a static website. Changes save automatically.
      </p>

      {isEnabled ? (
        <div className="mt-4 border-t border-rule pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <InputField
              form={form}
              name="websiteConfig.indexDocument"
              title="Index document"
              spellCheck={false}
            />
            <InputField
              form={form}
              name="websiteConfig.errorDocument"
              title="Error document"
              spellCheck={false}
            />
          </div>

          {links.length > 0 ? (
            <ul className="mt-4 grid gap-1">
              {links.map((host) => (
                <li key={host} className="min-w-0">
                  <a
                    href={`http://${host}`}
                    className="xlink inline-flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={13} aria-hidden className="shrink-0" />
                    {host}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-ink-3">
              Add a global alias to get a website address.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-ink-3">
          Off. Only keys with read access can fetch objects.
        </p>
      )}
    </Panel>
  );
};

export default WebsiteAccessSection;
