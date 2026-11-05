import { useDenyKey } from "../hooks";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import AllowKeyDialog from "./allow-key-dialog";
import { toast } from "sonner";
import { useBucketContext } from "../context";
import { EmptyState } from "@/components/ui/state";
import { confirmAction } from "@/components/ui/confirm-store";
import { Ledger, LedgerColumn } from "@/components/ui/ledger";
import { Panel } from "@/components/ui/page-header";
import IconButton from "@/components/ui/icon-button";
import CopyButton from "@/components/ui/copy-button";
import Perm from "@/components/ui/perm";
import { bucketName, grantedKeys } from "../../utils";
import { textLink } from "../../styles";
import { Key } from "../../types";
import { keyLabel } from "@/pages/keys/utils";
import { cn } from "@/lib/utils";
import { searchPath } from "@/lib/routes";

/** The keys that can use this bucket, with their read, write and owner grants. */
const AccessTab = () => {
  const { bucket } = useBucketContext();
  const name = bucketName(bucket);

  const denyKey = useDenyKey(bucket.id);

  const keys = grantedKeys(bucket.keys);

  const onRemove = async (key: Key) => {
    const label = keyLabel(key);
    const ok = await confirmAction({
      title: "Remove key access",
      message: `Remove ${label} from ${name}? The key itself stays available for other buckets.`,
      confirmLabel: "Remove access",
      danger: true,
      action: () =>
        denyKey.mutateAsync({
          keyId: key.accessKeyId,
          permissions: { read: true, write: true, owner: true },
        }),
    });
    if (ok) toast.success("Key access removed");
  };

  const columns: LedgerColumn<Key>[] = [
    {
      key: "key",
      header: "Key",
      mobile: "title",
      width: "24%",
      cell: (key) => (
        <Link
          to={searchPath("keys", key.accessKeyId)}
          title={key.name || key.accessKeyId}
          className={cn(
            textLink,
            "font-medium max-md:[overflow-wrap:anywhere]",
          )}
        >
          {keyLabel(key)}
        </Link>
      ),
    },
    {
      key: "id",
      header: "Access key ID",
      width: "32%",
      cell: (key) => (
        <span className="flex min-w-0 items-center gap-0.5">
          <span
            title={key.accessKeyId}
            className="min-w-0 truncate font-mono text-[12.5px] max-md:[overflow-wrap:anywhere]"
          >
            {key.accessKeyId}
          </span>
          <CopyButton
            value={key.accessKeyId}
            label={`Copy access key ID of ${keyLabel(key)}`}
            iconOnly
          />
        </span>
      ),
    },
    {
      key: "grant",
      header: "Grant",
      width: "13%",
      cell: (key) => <Perm {...key.permissions} />,
    },
    {
      key: "aliases",
      header: "Local aliases",
      width: "19%",
      cell: (key) => {
        const text = key.bucketLocalAliases?.join(", ");
        return text ? (
          <span title={text} className="font-mono text-[12.5px]">
            {text}
          </span>
        ) : (
          <span className="text-ink-3">None</span>
        );
      },
    },
    {
      key: "remove",
      header: <span className="sr-only">Remove access</span>,
      align: "right",
      mobile: "actions",
      width: "5rem",
      cell: (key) => (
        <div className="row-actions">
          <IconButton
            label={`Remove access of ${keyLabel(key)}`}
            icon={X}
            variant="ghost-danger"
            onClick={() => void onRemove(key)}
          />
        </div>
      ),
    },
  ];

  return (
    <Panel
      id="access"
      title="Keys with access"
      meta={`${keys.length} ${keys.length === 1 ? "key" : "keys"}`}
      actions={
        <AllowKeyDialog currentKeys={keys.map((key) => key.accessKeyId)} />
      }
      flush
    >
      <p className="border-b border-line px-4 py-2.5 text-ink-3">
        <span className="font-medium text-ink-2">R</span> read ·{" "}
        <span className="font-medium text-ink-2">W</span> write ·{" "}
        <span className="font-medium text-ink-2">O</span> owner. A filled cell
        is granted.
      </p>
      <Ledger
        caption={`Keys with access to ${name}`}
        columns={columns}
        rows={keys}
        rowKey={(key) => key.accessKeyId}
        empty={
          <EmptyState title="No key can use this bucket">
            Allow a key with read and write access to browse and fill this
            bucket.
          </EmptyState>
        }
      />
    </Panel>
  );
};

export default AccessTab;
