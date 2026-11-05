import { resolveAddress, toAddressBucket } from "@/lib/address";
import { targetLabel } from "@/lib/crumbs";
import { bucketPath, searchPath } from "@/lib/routes";
import appStore from "@/stores/app-store";
import { useBuckets } from "@/pages/buckets/hooks";
import { getStatusNodes, useClusterStatus } from "@/pages/cluster/hooks";
import { useKeys } from "@/pages/keys/hooks";
import { Command } from "cmdk";
import {
  Archive,
  CornerDownLeft,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Search,
  Server,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Kbd from "../ui/kbd";
import { NAV } from "./nav";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
};

const item =
  "flex min-h-10 cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-ink outline-none md:min-h-9 " +
  "[&_svg]:flex-none [&_svg]:text-ink-3 data-[selected=true]:bg-primary-soft data-[selected=true]:[&_svg]:text-ink-2";
const group =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-cond [&_[cmdk-group-heading]]:text-label [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-ink-3";

const Note = ({ children }: { children: string }) => (
  <p role="status" className="px-2.5 py-1.5 text-ink-3">
    {children}
  </p>
);

/**
 * The palette (Ctrl/⌘ K or /). Type a name, an ID or an address (media-assets/photos/, s3://media-assets,
 * keys/ci-deploy, cluster/ams1-b) and Enter goes there; the lists below are the same places for anyone who prefers
 * to pick. Everything comes from the live queries; names are labels, the route always carries the ID.
 */
const Palette = ({ open, onOpenChange, onSignOut }: Props) => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const buckets = useBuckets();
  const keys = useKeys();
  const status = useClusterStatus();

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const addressBuckets = useMemo(
    () => (buckets.data ?? []).map(toAddressBucket),
    [buckets.data],
  );
  const nodes = useMemo(() => getStatusNodes(status.data), [status.data]);

  const target = useMemo(
    () =>
      resolveAddress(value, {
        buckets: addressBuckets,
        keys: keys.data ?? [],
        nodes: nodes.map((n) => ({ id: n.id, hostname: n.hostname })),
      }),
    [value, addressBuckets, keys.data, nodes],
  );
  const label = useMemo(
    () => (target ? targetLabel(target, addressBuckets) : ""),
    [target, addressBuckets],
  );

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  const setTheme = (t: "light" | "dark" | "system") => {
    appStore.setTheme(t);
    onOpenChange(false);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search buckets, keys, nodes and pages"
      overlayClassName="veil fixed inset-0 z-[60] bg-scrim"
      contentClassName="dialog-in fixed left-1/2 top-[10vh] z-[70] w-[min(35rem,94vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-pop"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-4 focus-within:border-focus">
        <Search size={16} aria-hidden className="flex-none text-ink-3" />
        <Command.Input
          value={value}
          onValueChange={setValue}
          placeholder="Search, or type an address like my-bucket/photos/"
          className="h-[50px] min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </div>
      <Command.List className="max-h-[min(24rem,60dvh)] overflow-auto p-1.5">
        {/* cmdk counts only filtered rows: a forceMount row is not one, so it would not hide this message. */}
        {target ? null : (
          <Command.Empty className="px-3 py-6 text-center text-ink-3">
            Nothing at that address. Try a bucket name,{" "}
            <span className="text-ink-2">keys/</span> or{" "}
            <span className="text-ink-2">cluster/</span>.
          </Command.Empty>
        )}

        {target ? (
          <Command.Group heading="Address" forceMount className={group}>
            <Command.Item
              forceMount
              value={`go ${value}`}
              onSelect={() => go(target)}
              className={item}
            >
              <CornerDownLeft size={16} aria-hidden />
              <span className="min-w-0 flex-1 truncate">Open {label}</span>
            </Command.Item>
          </Command.Group>
        ) : null}

        <Command.Group heading="Pages" className={group}>
          {NAV.map((n) => (
            <Command.Item
              key={n.to}
              value={`garage://${n.slug}`}
              keywords={[n.label]}
              onSelect={() => go(n.to)}
              className={item}
            >
              <n.icon size={16} aria-hidden /> {n.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Buckets" className={group}>
          {buckets.isPending ? <Note>Loading buckets…</Note> : null}
          {buckets.isError ? (
            <Note>{`Could not load buckets: ${buckets.error.message}`}</Note>
          ) : null}
          {(buckets.data ?? []).map((b) => {
            const a = toAddressBucket(b);
            return (
              <Command.Item
                key={b.id}
                value={`s3://${a.name} ${a.aliases.join(" ")} ${b.id}`}
                onSelect={() => go(bucketPath(b.id))}
                className={item}
              >
                <Archive size={16} aria-hidden />
                <span className="min-w-0 truncate" title={a.name}>
                  {a.name}
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>

        <Command.Group heading="Access keys" className={group}>
          {keys.isPending ? <Note>Loading keys…</Note> : null}
          {keys.isError ? (
            <Note>{`Could not load keys: ${keys.error.message}`}</Note>
          ) : null}
          {(keys.data ?? []).map((k) => (
            <Command.Item
              key={k.id}
              value={`keys/${k.name} ${k.id}`}
              onSelect={() => go(searchPath("keys", k.id))}
              className={item}
            >
              <KeyRound size={16} aria-hidden />
              <span className="min-w-0 truncate" title={k.name || k.id}>
                {k.name || k.id}
              </span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Nodes" className={group}>
          {status.isPending ? <Note>Loading nodes…</Note> : null}
          {status.isError ? (
            <Note>{`Could not load nodes: ${status.error.message}`}</Note>
          ) : null}
          {nodes.map((n) => (
            <Command.Item
              key={n.id}
              value={`cluster/${n.hostname} ${n.id}`}
              onSelect={() => go(searchPath("cluster", n.id))}
              className={item}
            >
              <Server size={16} aria-hidden />
              <span className="min-w-0 truncate" title={n.hostname ?? n.id}>
                {n.hostname || n.id}
              </span>
              {!n.isUp ? (
                <span className="ml-auto text-caption text-ink-3">down</span>
              ) : null}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Actions" className={group}>
          <Command.Item
            value="theme light"
            onSelect={() => setTheme("light")}
            className={item}
          >
            <Sun size={16} aria-hidden /> Theme: Light
          </Command.Item>
          <Command.Item
            value="theme dark"
            onSelect={() => setTheme("dark")}
            className={item}
          >
            <Moon size={16} aria-hidden /> Theme: Dark
          </Command.Item>
          <Command.Item
            value="theme system"
            onSelect={() => setTheme("system")}
            className={item}
          >
            <Monitor size={16} aria-hidden /> Theme: System
          </Command.Item>
          <Command.Item
            value="sign out log out"
            onSelect={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className={item}
          >
            <LogOut size={16} aria-hidden /> Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
      <div className="hint-kbd flex items-center gap-3.5 border-t border-line bg-surface-2 px-3.5 py-2 text-caption text-ink-3">
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↵</Kbd> open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>esc</Kbd> close
        </span>
      </div>
    </Command.Dialog>
  );
};

export default Palette;
