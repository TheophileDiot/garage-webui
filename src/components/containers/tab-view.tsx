import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { KeyboardEvent, useEffect, useId, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export type Tab = {
  name: string;
  title?: string;
  icon?: LucideIcon;
  Component?: () => JSX.Element | null;
};

type Props = {
  tabs: Tab[];
  name?: string;
  /** Accessible name of the tab list. */
  label: string;
  /**
   * Maps the raw `?tab=` value to a tab name (for example `bucketTab`, which also reads the pre-redesign values).
   * When the URL holds a different spelling of the same tab, it is replaced in place with the canonical one.
   */
  normalize?: (raw: string | null) => string;
  className?: string;
  contentClassName?: string;
};

const TabView = ({
  tabs,
  name = "tab",
  label,
  normalize,
  className,
  contentClassName,
}: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(name);
  const requested = normalize ? normalize(raw) : raw;
  const curTab = tabs.some((tab) => tab.name === requested)
    ? requested!
    : tabs[0].name;
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const Content = tabs.find((tab) => tab.name === curTab)?.Component;

  const select = (tabName: string) =>
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set(name, tabName);
        return next;
      },
      { replace: true },
    );

  // A legacy spelling in the URL is rewritten once, with replace, so history keeps no extra entry.
  useEffect(() => {
    if (normalize && raw !== null && raw !== curTab) {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.set(name, curTab);
          return next;
        },
        { replace: true },
      );
    }
  }, [normalize, raw, curTab, name, setSearchParams]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].name);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className={cn(
          "mb-4 flex gap-1 overflow-x-auto border-b border-line-strong",
          className,
        )}
      >
        {tabs.map(({ icon: Icon, ...tab }, index) => {
          const active = curTab === tab.name;
          return (
            <button
              key={tab.name}
              ref={(el) => {
                refs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`${uid}-tab-${tab.name}`}
              aria-selected={active}
              aria-controls={`${uid}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(tab.name)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3.5 font-medium transition-colors duration-100",
                active
                  ? "border-ink font-semibold text-ink"
                  : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              {Icon ? (
                <Icon size={16} aria-hidden className="hidden sm:block" />
              ) : null}
              <span>{tab.title || tab.name}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${curTab}`}
        className={contentClassName}
      >
        {Content ? <Content /> : null}
      </div>
    </>
  );
};

export default TabView;
