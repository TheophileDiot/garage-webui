import { useParams, useSearchParams } from "react-router-dom";
import { Globe } from "lucide-react";
import { useBucket } from "./hooks";
import Page from "@/context/page-context";
import TabView, { Tab } from "@/components/containers/tab-view";
import SettingsTab from "./settings/settings-tab";
import AccessTab from "./access/access-tab";
import BrowseTab from "./browse/browse-tab";
import Actions from "./browse/actions";
import { canBrowse } from "./browse/model";
import BucketIdentity from "./components/bucket-identity";
import BucketFacts from "./components/bucket-facts";
import { BucketContext } from "./context";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import Button, { LinkButton } from "@/components/ui/button";
import { bucketTab } from "@/lib/bucket-tabs";
import { PLACES } from "@/lib/routes";
import { bucketName } from "../utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** The summary strip sits under the tabs and stays on all three; on phone it is one line (Size · Objects · Quota). */
const withFacts = (Content: () => JSX.Element | null) => () => (
  <>
    <BucketFacts />
    <Content />
  </>
);

const tabs: Tab[] = [
  { name: "objects", title: "Objects", Component: withFacts(BrowseTab) },
  { name: "access", title: "Access", Component: withFacts(AccessTab) },
  { name: "settings", title: "Settings", Component: withFacts(SettingsTab) },
];

const ManageBucketPage = () => {
  const { id } = useParams();
  const { data, error, isLoading, refetch } = useBucket(id);

  // The first global alias is the name clients and the browse tab use; the title falls back to a local alias or id.
  const name = data?.globalAliases[0];
  const title = data ? bucketName(data) : "Bucket";

  // On phone Upload and New folder move from the list's toolbar to the title row (the browse tab drops its own).
  const phone = useMediaQuery("(max-width: 767px)");
  const [searchParams] = useSearchParams();
  const context = data
    ? { bucket: data, refetch, globalAlias: name || "" }
    : null;
  const headerActions =
    phone &&
    data &&
    context &&
    bucketTab(searchParams.get("tab")) === "objects" &&
    canBrowse(data.keys, context.globalAlias) ? (
      <BucketContext.Provider key={data.id} value={context}>
        <Actions prefix={searchParams.get("prefix") || ""} compact />
      </BucketContext.Provider>
    ) : undefined;

  return (
    <>
      <Page title={title} />

      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="min-w-0">{title}</span>
            {data?.websiteAccess ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 font-sans text-caption font-medium text-link">
                <Globe size={13} aria-hidden />
                Website hosting on
              </span>
            ) : null}
          </span>
        }
        actions={headerActions}
      />

      {isLoading && (
        <Panel flush>
          <SkeletonRows label="Loading bucket" rows={5} />
        </Panel>
      )}

      {error != null && (
        <Panel flush>
          <ErrorState
            title="Could not load this bucket"
            error={error}
            onRetry={() => void refetch()}
            action={
              <div className="flex flex-wrap gap-2">
                <LinkButton href={PLACES.buckets}>Back to buckets</LinkButton>
                <Button onClick={() => void refetch()}>Try again</Button>
              </div>
            }
          />
        </Panel>
      )}

      {data && (
        // The route keeps this page mounted when only :id changes, so the key resets every per-bucket state below
        // (selection, filter, folder history, Details sheet, autosave) in one place.
        <BucketContext.Provider key={data.id} value={context!}>
          <BucketIdentity bucket={data} />
          <TabView
            tabs={tabs}
            label="Bucket sections"
            normalize={bucketTab}
            sticky
          />
        </BucketContext.Provider>
      )}
    </>
  );
};

export default ManageBucketPage;
