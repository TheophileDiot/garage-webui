import { useParams, useSearchParams } from "react-router-dom";
import { useBucket } from "./hooks";
import Page from "@/context/page-context";
import TabView, { Tab } from "@/components/containers/tab-view";
import { ChartLine, FolderSearch, LockKeyhole } from "lucide-react";
import OverviewTab from "./overview/overview-tab";
import PermissionsTab from "./permissions/permissions-tab";
import DeleteBucketButton from "./components/delete-bucket-button";
import BrowseTab from "./browse/browse-tab";
import { BucketContext } from "./context";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import Button, { LinkButton } from "@/components/ui/button";
import CopyButton from "@/components/ui/copy-button";
import { readableBytes } from "@/lib/utils";
import { bucketName } from "../utils";

const tabs: Tab[] = [
  {
    name: "overview",
    title: "Overview",
    icon: ChartLine,
    Component: OverviewTab,
  },
  {
    name: "permissions",
    title: "Permissions",
    icon: LockKeyhole,
    Component: PermissionsTab,
  },
  { name: "browse", title: "Browse", icon: FolderSearch, Component: BrowseTab },
];

const ManageBucketPage = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, error, isLoading, refetch } = useBucket(id);

  // The first global alias is the name clients and the browse tab use; the title falls back to a local alias or id.
  const name = data?.globalAliases[0];
  const title = data ? bucketName(data) : "Bucket";

  return (
    <>
      <Page title={title} />

      <PageHeader
        title={title}
        address={data ? `s3://${name ?? data.id}/` : undefined}
        meta={
          data ? (
            <span className="inline-flex flex-wrap items-center gap-x-3">
              <span>
                {data.objects.toLocaleString()} objects ·{" "}
                {readableBytes(data.bytes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span title={data.id}>id {data.id.slice(0, 8)}…</span>
                <CopyButton
                  value={data.id}
                  label={`Copy bucket id of ${title}`}
                />
              </span>
            </span>
          ) : undefined
        }
        actions={
          data ? (
            <>
              {params.get("tab") !== "browse" ? (
                <LinkButton
                  variant="primary"
                  href={`/buckets/${data.id}?tab=browse`}
                >
                  Browse objects
                </LinkButton>
              ) : null}
              <DeleteBucketButton id={data.id} name={title} />
            </>
          ) : undefined
        }
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
                <LinkButton href="/buckets">Back to buckets</LinkButton>
                <Button onClick={() => void refetch()}>Try again</Button>
              </div>
            }
          />
        </Panel>
      )}

      {data && (
        <div className="pb-8">
          <BucketContext.Provider
            value={{ bucket: data, refetch, bucketName: name || "" }}
          >
            <TabView tabs={tabs} label="Bucket sections" />
          </BucketContext.Provider>
        </div>
      )}
    </>
  );
};

export default ManageBucketPage;
