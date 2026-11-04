import { shareDialog } from "./stores";
import Dialog from "@/components/ui/dialog";
import { useBucketContext } from "../context";
import { useConfig } from "@/hooks/useConfig";
import { useMemo, useState } from "react";
import { TextField } from "@/components/ui/input";
import Button from "@/components/ui/button";
import CopyButton from "@/components/ui/copy-button";
import { TriangleAlert } from "lucide-react";

const ShareDialog = () => {
  const { isOpen, data } = shareDialog.use();
  const { bucket, bucketName } = useBucketContext();
  const { data: config } = useConfig();
  const [picked, setPicked] = useState<string | null>(null);

  const websitePort = config?.s3_web?.bind_addr?.split(":").pop() || "80";
  const rootDomain = config?.s3_web?.root_domain;

  // Without a root domain in the config only the bare alias is a real host.
  const domains = useMemo(
    () =>
      rootDomain
        ? [
            bucketName,
            bucketName + rootDomain,
            bucketName + rootDomain + `:${websitePort}`,
          ]
        : [bucketName],
    [bucketName, rootDomain, websitePort],
  );

  const domain = picked && domains.includes(picked) ? picked : bucketName;
  const url =
    "http://" + domain + "/" + (data?.prefix ?? "") + (data?.key ?? "");

  return (
    <Dialog
      open={isOpen}
      onClose={shareDialog.close}
      title="Share link"
      description={
        <span className="[overflow-wrap:anywhere]">
          {bucketName}/{data?.prefix}
          {data?.key}
        </span>
      }
      size="lg"
      actions={<Button onClick={() => shareDialog.close()}>Close</Button>}
    >
      <div className="grid gap-4">
        {!bucket.websiteAccess && (
          <div
            role="note"
            className="flex items-start gap-3 rounded-sm border border-warn p-3 text-ink"
          >
            <TriangleAlert
              size={16}
              className="mt-0.5 shrink-0 text-warn"
              aria-hidden
            />
            Sharing is only available for buckets with website access enabled.
          </div>
        )}

        <fieldset className="grid gap-1">
          <legend className="mb-1 text-caption font-medium text-ink-2">
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
                className="size-4 shrink-0 accent-gold-text"
                checked={item === domain}
                onChange={() => setPicked(item)}
              />
              <span className="[overflow-wrap:anywhere]">{item}</span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-1">
          <TextField
            label="Link"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <div>
            <CopyButton value={url} label="Copy link" />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ShareDialog;
