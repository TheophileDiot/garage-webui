import { DeepPartial, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { websiteConfigSchema, WebsiteConfigSchema } from "../schema";
import { useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useUpdateBucket } from "../hooks";
import { useConfig } from "@/hooks/useConfig";
import { ExternalLink, Info } from "lucide-react";
import Button from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { ToggleField } from "@/components/ui/toggle";
import { useBucketContext } from "../context";
import { handleError } from "@/lib/utils";
import SaveState from "./save-state";

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
  const { mutate } = updateMutation;

  const onChange = useDebounce((values: DeepPartial<WebsiteConfigSchema>) => {
    mutate(
      {
        websiteAccess: {
          enabled: values.websiteAccess,
          indexDocument: values.websiteAccess
            ? values.websiteConfig?.indexDocument
            : undefined,
          errorDocument: values.websiteAccess
            ? values.websiteConfig?.errorDocument
            : undefined,
        },
      },
      { onError: handleError },
    );
  });

  useEffect(() => {
    reset({
      websiteAccess: data?.websiteAccess,
      websiteConfig: {
        indexDocument: data?.websiteConfig?.indexDocument || "index.html",
        errorDocument: data?.websiteConfig?.errorDocument || "error/400.html",
      },
    });

    const { unsubscribe } = watch((values) => onChange(values));
    return unsubscribe;
  }, [data, reset, watch, onChange]);

  const links = [
    `${bucketName}`,
    ...(rootDomain
      ? [
          `${bucketName}${rootDomain}`,
          `${bucketName}${rootDomain}:${websitePort}`,
        ]
      : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <h3 className="title">Website access</h3>
          <Button
            href="https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites"
            target="_blank"
            size="sm"
            color="ghost"
            icon={Info}
            aria-label="Website hosting documentation (opens in a new tab)"
          />
        </div>
        <SaveState mutation={updateMutation} />
      </div>
      <p className="muted mt-1 text-sm">
        Serve the bucket as a static website. Changes save automatically.
      </p>
      <ToggleField
        form={form}
        name="websiteAccess"
        label="Serve as website"
        className="mt-3"
      />

      {isEnabled && (
        <>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputField
              form={form}
              name="websiteConfig.indexDocument"
              title="Index document"
            />
            <InputField
              form={form}
              name="websiteConfig.errorDocument"
              title="Error document"
            />
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-base-300 bg-base-200 p-4 text-sm">
            {links.map((host) => (
              <li key={host}>
                <a
                  href={`http://${host}`}
                  className="link-latch inline-flex items-center gap-2 font-bold"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} aria-hidden />
                  {host}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default WebsiteAccessSection;
