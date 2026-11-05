import { crumbsForRoute } from "@/lib/crumbs";
import { useBuckets } from "@/pages/buckets/hooks";
import { bucketName } from "@/pages/buckets/utils";
import { ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Where you are, from the route: "Buckets / media-assets". Bucket names come from the live list, the route keeps
 * the ID. A long name is cut with an ellipsis (the full text is in `title`), it never widens the bar.
 */
const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const { data: buckets } = useBuckets();
  const crumbs = useMemo(
    () =>
      crumbsForRoute(
        pathname,
        (buckets ?? []).map((b) => ({ id: b.id, name: bucketName(b) })),
      ),
    [pathname, buckets],
  );

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap"
    >
      {crumbs.map((c, i) => (
        <Fragment key={`${i}-${c.label}`}>
          {i > 0 ? (
            <ChevronRight
              size={14}
              aria-hidden
              className="flex-none text-ink-3"
            />
          ) : null}
          {c.to ? (
            <Link
              to={c.to}
              className="inline-flex min-h-9 flex-none items-center rounded-sm text-ink-2 hover:text-ink hover:underline md:min-h-6"
            >
              {c.label}
            </Link>
          ) : (
            <span
              aria-current="page"
              title={c.label}
              className="min-w-0 truncate font-semibold text-ink"
            >
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
