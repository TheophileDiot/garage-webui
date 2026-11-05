import { shareDialog } from "./stores";
import Dialog from "@/components/ui/dialog";
import { useBucketContext } from "../context";
import { useConfig } from "@/hooks/useConfig";
import { useMemo, useState } from "react";
import { TextField } from "@/components/ui/input";
import Button from "@/components/ui/button";
import CopyButton from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/notice";

const ShareDialog = () => {
  const { isOpen, data } = shareDialog.use();
  const { bucket, globalAlias } = useBucketContext();
  const { data: config } = useConfig();
  const [picked, setPicked] = useState<string | null>(null);

  const websitePort = config?.s3_web?.bind_addr?.split(":").pop() || "80";
  const rootDomain = config?.s3_web?.root_domain;

  // Without a root domain in the config only the bare alias is a real host.
  const domains = useMemo(
    () =>
      rootDomain
        ? [
            globalAlias,
            globalAlias + rootDomain,
            globalAlias + rootDomain + `:${websitePort}`,
          ]
        : [globalAlias],
    [globalAlias, rootDomain, websitePort],
  );

  const domain = picked && domains.includes(picked) ? picked : globalAlias;
  const url =
    "http://" + domain + "/" + (data?.prefix ?? "") + (data?.key ?? "");

  return (
    <Dialog
      open={isOpen}
      onClose={shareDialog.close}
      title="Share link"
      description={
        <span className="[overflow-wrap:anywhere]">
          {globalAlias}/{data?.prefix}
          {data?.key}
        </span>
      }
      size="lg"
      actions={<Button onClick={() => shareDialog.close()}>Close</Button>}
    >
      <div className="grid gap-4">
        {!bucket.websiteAccess && (
          <Notice tone="warn">
            Sharing is only available for buckets with website access enabled.
          </Notice>
        )}

        <fieldset className="m-0 grid gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-caption font-medium text-ink-2">
            Domain
          </legend>
          {domains.map((item) => (
            <label
              key={item}
              className="flex min-h-6 cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name="share-domain"
                className="size-4 shrink-0 accent-primary"
                checked={item === domain}
                onChange={() => setPicked(item)}
              />
              <span className="font-mono text-[12.5px] [overflow-wrap:anywhere]">
                {item}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-2">
          <TextField
            label="Link"
            readOnly
            value={url}
            className="font-mono text-[12.5px]"
            onFocus={(e) => e.target.select()}
          />
          <div>
            <CopyButton
              value={url}
              label="Copy link"
              className="h-9 md:h-[34px]"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ShareDialog;
