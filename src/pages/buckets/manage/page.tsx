import { useParams } from "react-router-dom";
import { useBucket } from "./hooks";
import Page from "@/context/page-context";
import TabView, { Tab } from "@/components/containers/tab-view";
import { ChartLine, FolderSearch, LockKeyhole } from "lucide-react";
import OverviewTab from "./overview/overview-tab";
import PermissionsTab from "./permissions/permissions-tab";
import MenuButton from "./components/menu-button";
import BrowseTab from "./browse/browse-tab";
import { BucketContext } from "./context";
import { ErrorState, SkeletonRows } from "@/components/ui/state";

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
  const { data, error, isLoading, refetch } = useBucket(id);

  const name = data?.globalAliases[0];

  return (
    <>
      <Page
        title={name || data?.localAliases?.[0]?.alias || "Bucket"}
        prev="/buckets"
        actions={data ? <MenuButton /> : undefined}
      />

      {isLoading && (
        <div className="container panel">
          <SkeletonRows label="Loading bucket" rows={5} />
        </div>
      )}

      {error != null && (
        <div className="container panel">
          <ErrorState
            title="Could not load this bucket"
            error={error}
            onRetry={() => void refetch()}
          />
        </div>
      )}

      {data && (
        <div className="container">
          <BucketContext.Provider
            value={{ bucket: data, refetch, bucketName: name || "" }}
          >
            <TabView tabs={tabs} />
          </BucketContext.Provider>
        </div>
      )}
    </>
  );
};

export default ManageBucketPage;
