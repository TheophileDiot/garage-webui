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
import Perm from "@/components/ui/perm";
import { bucketName } from "../../utils";
import { Key } from "../../types";
import { keyLabel } from "@/pages/keys/utils";

const PermissionsTab = () => {
  const { bucket } = useBucketContext();
  const name = bucketName(bucket);

  const denyKey = useDenyKey(bucket.id);

  const keys = bucket.keys.filter(
    (key) =>
      key.permissions.read || key.permissions.write || key.permissions.owner,
  );

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
          to={`/keys?q=${encodeURIComponent(key.accessKeyId)}`}
          title={key.name || key.accessKeyId}
          className="xlink font-medium max-md:[overflow-wrap:anywhere]"
        >
          {keyLabel(key)}
        </Link>
      ),
    },
    {
      key: "id",
      header: "Access key id",
      width: "30%",
      cell: (key) => (
        <span title={key.accessKeyId} className="text-ink-2">
          {key.accessKeyId}
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
      width: "21%",
      cell: (key) => {
        const text = key.bucketLocalAliases?.join(", ");
        return text ? (
          <span title={text}>{text}</span>
        ) : (
          <span className="text-ink-3">none</span>
        );
      },
    },
    {
      key: "remove",
      header: <span className="sr-only">Remove access</span>,
      align: "right",
      mobile: "actions",
      width: "5rem",
      cell: (key) => {
        const label = keyLabel(key);
        return (
          <IconButton
            label={`Remove access of ${label}`}
            icon={X}
            variant="ghost-danger"
            onClick={() => void onRemove(key)}
          />
        );
      },
    },
  ];

  return (
    <Panel
      id="permissions"
      title="Keys with access"
      aside={
        <AllowKeyDialog currentKeys={keys.map((key) => key.accessKeyId)} />
      }
      flush
    >
      <p className="border-b border-rule px-3 py-2 text-ink-3">
        <span className="text-ink-2">R</span> read ·{" "}
        <span className="text-ink-2">W</span> write ·{" "}
        <span className="text-ink-2">O</span> owner. A filled cell is granted.
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

export default PermissionsTab;
