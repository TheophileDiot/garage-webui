import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

type Props = {
  curPrefix: number;
  setCurPrefix: (index: number) => void;
  prefixHistory: string[];
  actions?: React.ReactNode;
};

const folderName = (prefix: string) =>
  prefix.substring(0, prefix.lastIndexOf("/")).split("/").pop();

const ObjectListNavigator = ({
  curPrefix,
  setCurPrefix,
  prefixHistory,
  actions,
}: Props) => {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-base-300 p-3">
      <div className="order-1 flex items-center">
        <Button
          icon={ChevronLeft}
          size="sm"
          color="ghost"
          aria-label="Previous folder"
          disabled={curPrefix < 0}
          onClick={() => setCurPrefix(curPrefix - 1)}
        />
        <Button
          icon={ChevronRight}
          size="sm"
          color="ghost"
          aria-label="Next folder"
          disabled={curPrefix >= prefixHistory.length - 1}
          onClick={() => setCurPrefix(curPrefix + 1)}
        />
      </div>

      <nav
        aria-label="Folder path"
        className="order-3 h-10 w-full min-w-0 flex-none overflow-x-auto rounded-lg bg-base-200 px-1 md:order-2 md:w-auto md:flex-1"
      >
        <ol className="flex h-full items-center">
          <li className="shrink-0">
            <Crumb
              active={curPrefix === -1}
              onClick={() => setCurPrefix(-1)}
              label="Bucket root"
            >
              <Home size={16} aria-hidden />
            </Crumb>
          </li>
          {prefixHistory.map((prefix, i) => (
            <Fragment key={prefix}>
              <li aria-hidden className="shrink-0 text-base-content/50">
                <ChevronRight size={16} />
              </li>
              <li className="shrink-0">
                <Crumb active={i === curPrefix} onClick={() => setCurPrefix(i)}>
                  {folderName(prefix)}
                </Crumb>
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>

      <div className="order-2 flex flex-1 items-center justify-end md:order-3 md:flex-initial">
        {actions}
      </div>
    </div>
  );
};

type CrumbProps = {
  label?: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

const Crumb = ({ label, active, onClick, children }: CrumbProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-current={active ? "location" : undefined}
    className={cn(
      "flex h-8 max-w-[10rem] items-center truncate rounded-md px-2 text-sm font-bold transition-colors",
      active
        ? "bg-base-100 text-primary"
        : "text-base-content/80 hover:bg-base-content/10",
    )}
  >
    {children}
  </button>
);

export default ObjectListNavigator;
