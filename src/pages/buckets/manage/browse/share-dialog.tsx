import { shareDialog } from "./stores";
import Dialog from "@/components/ui/dialog";
import { useBucketContext } from "../context";
import { useConfig } from "@/hooks/useConfig";
import { useMemo, useState } from "react";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import { Copy, FileWarningIcon } from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

const ShareDialog = () => {
  const { isOpen, data } = shareDialog.use();
  const { bucket, bucketName } = useBucketContext();
  const { data: config } = useConfig();
  const [picked, setPicked] = useState<string | null>(null);

  const websitePort = config?.s3_web?.bind_addr?.split(":").pop() || "80";
  const rootDomain = config?.s3_web?.root_domain;

  const domains = useMemo(
    () => [
      bucketName,
      bucketName + rootDomain,
      bucketName + rootDomain + `:${websitePort}`,
    ],
    [bucketName, rootDomain, websitePort],
  );

  const domain = picked && domains.includes(picked) ? picked : bucketName;
  const url = "http://" + domain + "/" + data?.prefix + data?.key;

  return (
    <Dialog
      open={isOpen}
      onClose={shareDialog.close}
      title={<span className="block truncate">Share {data?.key || ""}</span>}
      className="max-w-xl"
      actions={<Button onClick={() => shareDialog.close()}>Close</Button>}
    >
      {!bucket.websiteAccess && (
        <div
          role="note"
          className="mb-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <FileWarningIcon
            size={18}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          Sharing is only available for buckets with website access enabled.
        </div>
      )}
      <fieldset>
        <legend className="label label-text">Domain</legend>
        <div className="flex flex-col gap-1">
          {domains.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-2 py-1 text-sm"
            >
              <input
                type="radio"
                name="share-domain"
                className="radio radio-sm radio-primary"
                checked={item === domain}
                onChange={() => setPicked(item)}
              />
              <span className="mono break-all">{item}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="relative mt-4">
        <label htmlFor="share-url" className="label label-text">
          Link
        </label>
        <Input
          id="share-url"
          readOnly
          value={url}
          className="mono w-full pr-12"
          onFocus={(e) => e.target.select()}
        />
        <Button
          icon={Copy}
          size="sm"
          onClick={() => copyToClipboard(url)}
          className="absolute bottom-1 right-1"
          color="ghost"
          aria-label="Copy link"
        />
      </div>
    </Dialog>
  );
};

export default ShareDialog;
