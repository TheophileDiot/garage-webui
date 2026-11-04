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
  /** Accessible name of the tab list. */
  label: string;
  className?: string;
  contentClassName?: string;
};

const TabView = ({
  tabs,
  name = "tab",
  label,
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
        const next = new URLSearchParams(params);
        next.set(name, tabName);
        return next;
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
        aria-label={label}
        className={cn(
          "-mx-4 flex gap-1 overflow-x-auto border-b border-rule px-4 md:mx-0 md:px-0",
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
                "relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 px-3 font-medium transition-colors duration-caret hover:bg-fill md:h-8",
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-bottom-left after:scale-x-0 after:bg-transparent after:transition-transform after:duration-caret after:ease-caret hover:after:scale-x-100 hover:after:scale-y-[2] hover:after:bg-gold focus-visible:after:bg-gold",
                active
                  ? "text-ink after:scale-x-100 after:bg-gold hover:after:scale-y-[2]"
                  : "text-ink-3 hover:text-ink",
              )}
            >
              {Icon ? (
                <Icon size={14} aria-hidden className="hidden sm:block" />
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
        className={cn("mt-5", contentClassName)}
      >
        {Content ? <Content /> : null}
      </div>
    </>
  );
};

export default TabView;
