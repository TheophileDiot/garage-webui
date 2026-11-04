import {
  addressForRoute,
  resolveAddress,
  toAddressBucket,
} from "@/lib/address";
import { useBuckets } from "@/pages/buckets/hooks";
import { getStatusNodes, useClusterStatus } from "@/pages/cluster/hooks";
import { useKeys } from "@/pages/keys/hooks";
import { Command } from "cmdk";
import { CornerDownLeft, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Kbd from "../ui/kbd";
import { NAV } from "./nav";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
};

const item =
  "flex h-10 cursor-default select-none items-center gap-3 rounded-sm px-2.5 text-ink-2 outline-none md:h-8 " +
  "data-[selected=true]:bg-gold data-[selected=true]:text-gold-ink data-[selected=true]:[&_kbd]:border-gold-ink data-[selected=true]:[&_kbd]:text-gold-ink";
const group =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:text-ink-3";

const Note = ({ children }: { children: string }) => (
  <p role="status" className="px-2.5 py-1.5 text-ink-3">
    {children}
  </p>
);

/**
 * The palette. Type an address (media-assets/photos/, s3://media-assets, keys/ci-deploy, cluster/ams1-b) and Enter
 * goes there; the lists below are the same places for anyone who prefers to pick. Everything comes from the live
 * queries; names are labels, the route always carries the ID.
 */
const Palette = ({
  open,
  onOpenChange,
  theme,
  onToggleTheme,
  onSignOut,
}: Props) => {
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
  const targetLabel = useMemo(() => {
    if (!target) return "";
    const [path, query = ""] = target.split("?");
    const q = new URLSearchParams(query).get("q");
    const base = addressForRoute(
      path,
      query ? `?${query}` : "",
      addressBuckets,
    );
    return q ? `${base}/${q}` : base;
  }, [target, addressBuckets]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Go to an address"
      overlayClassName="veil fixed inset-0 z-40 bg-[rgb(0_0_0/0.55)]"
      contentClassName="pop fixed left-1/2 top-[10vh] z-50 w-[min(38rem,94vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-rule-strong bg-lift-2 shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center gap-2 border-b border-rule px-3">
        <span className="select-none text-gold-text" aria-hidden>
          &gt;
        </span>
        <Command.Input
          value={value}
          onValueChange={setValue}
          placeholder="Type an address, e.g. my-bucket/photos/"
          className="h-11 min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3 focus-visible:[outline-offset:-2px] md:h-10"
          aria-label="Address or command"
        />
        <Kbd>esc</Kbd>
      </div>
      <Command.List className="max-h-[min(24rem,60dvh)] overflow-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-ink-3">
          Nothing at that address. Try a bucket name,{" "}
          <span className="text-ink-2">keys/</span> or{" "}
          <span className="text-ink-2">cluster/</span>.
        </Command.Empty>

        {target ? (
          <Command.Group heading="Address" className={group}>
            <Command.Item
              forceMount
              value={`go ${value}`}
              onSelect={() => go(target)}
              className={item}
            >
              <CornerDownLeft size={14} aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                Open {targetLabel}
              </span>
              <Kbd>enter</Kbd>
            </Command.Item>
          </Command.Group>
        ) : null}

        <Command.Group heading="Places" className={group}>
          {NAV.map((n) => (
            <Command.Item
              key={n.to}
              value={`garage://${n.label}`}
              onSelect={() => go(n.to)}
              className={item}
            >
              <n.icon size={14} aria-hidden /> {n.label}
              <Kbd className="ml-auto">g {n.key}</Kbd>
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
                onSelect={() => go(`/buckets/${encodeURIComponent(b.id)}`)}
                className={item}
              >
                <span className="text-ink-3">s3://</span>
                <span className="min-w-0 truncate" title={a.name}>
                  {a.name}
                </span>
              </Command.Item>
            );
          })}
        </Command.Group>

        <Command.Group heading="Keys" className={group}>
          {keys.isPending ? <Note>Loading keys…</Note> : null}
          {keys.isError ? (
            <Note>{`Could not load keys: ${keys.error.message}`}</Note>
          ) : null}
          {(keys.data ?? []).map((k) => (
            <Command.Item
              key={k.id}
              value={`keys/${k.name} ${k.id}`}
              onSelect={() => go(`/keys?${new URLSearchParams({ q: k.id })}`)}
              className={item}
            >
              <span className="text-ink-3">keys/</span>
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
              onSelect={() =>
                go(`/cluster?${new URLSearchParams({ q: n.id })}`)
              }
              className={item}
            >
              <span className="text-ink-3">cluster/</span>
              <span className="min-w-0 truncate" title={n.hostname}>
                {n.hostname || n.id}
              </span>
              {!n.isUp ? <span className="ml-auto">down</span> : null}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Actions" className={group}>
          <Command.Item
            value="toggle theme light dark"
            onSelect={() => {
              onToggleTheme();
              onOpenChange(false);
            }}
            className={item}
          >
            {theme === "dark" ? (
              <Sun size={14} aria-hidden />
            ) : (
              <Moon size={14} aria-hidden />
            )}
            Switch to {theme === "dark" ? "light" : "dark"} theme
          </Command.Item>
          <Command.Item
            value="sign out log out"
            onSelect={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className={item}
          >
            <LogOut size={14} aria-hidden /> Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
};

export default Palette;
