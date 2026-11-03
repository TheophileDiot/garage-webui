import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { KeyboardEvent, useId, useRef } from "react";
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
  className?: string;
  contentClassName?: string;
};

const TabView = ({
  tabs,
  name = "tab",
  className,
  contentClassName,
}: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(name);
  const curTab = tabs.some((tab) => tab.name === requested)
    ? requested!
    : tabs[0].name;
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const Content = tabs.find((tab) => tab.name === curTab)?.Component;

  const select = (tabName: string) =>
    setSearchParams(
      (params) => {
        params.set(name, tabName);
        return params;
      },
      { replace: true },
    );

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
        aria-label="Bucket sections"
        className={cn(
          "flex gap-1 overflow-x-auto border-b border-base-300",
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
                "relative flex h-12 shrink-0 items-center gap-2 px-3 text-sm font-bold sm:px-4 transition-colors",
                active
                  ? "text-primary"
                  : "text-base-content/70 hover:text-base-content",
              )}
            >
              {Icon ? (
                <Icon size={18} aria-hidden className="hidden sm:block" />
              ) : null}
              <span>{tab.title || tab.name}</span>
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-3 bottom-[-1px] h-0.5 origin-left rounded-full bg-primary transition-transform duration-150",
                  active ? "scale-x-100" : "scale-x-0",
                )}
              />
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel`}
        aria-labelledby={`${uid}-tab-${curTab}`}
        className={cn("mt-6", contentClassName)}
      >
        {Content ? <Content /> : null}
      </div>
    </>
  );
};

export default TabView;
