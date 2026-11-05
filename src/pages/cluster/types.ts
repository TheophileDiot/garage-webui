//

export type GetNodeInfoResult = {
  success: {
    [key: string]: {
      nodeId: string;
      garageVersion: string;
      garageFeatures: string[];
      rustVersion: string;
      dbEngine: string;
    };
  };
  error: { message?: string } | null;
};

export type GetStatusResult = {
  node: string;
  garageVersion: string;
  garageFeatures: string[];
  rustVersion: string;
  dbEngine: string;
  layoutVersion: number;
  nodes?: Node[];
  knownNodes?: Node[];
  layout?: GetClusterLayoutResult;
};

export type Node = {
  id: string;
  role?: Role | StagedRole;
  /** `null` for a node that is not connected. */
  addr: string | null;
  hostname: string;
  isUp: boolean;
  lastSeenSecsAgo: number | null;
  draining?: boolean;
  dataPartition?: DataPartition;
  metadataPartition?: DataPartition;
};

type DataPartition = {
  available: number;
  total: number;
};

export type Role = {
  id: string;
  zone: string;
  capacity: number | null;
  tags: string[];
};

export type StagedRole = { id: string; remove: boolean } & Partial<
  Omit<Role, "id">
>;

export type GetClusterLayoutResult = {
  version: number;
  roles: Role[];
  stagedRoleChanges: StagedRole[];
};

export type AssignNodeBody = {
  id: string;
  zone: string;
  capacity: number | null;
  tags: string[];
};

export type ApplyLayoutResult = {
  message: string[];
  layout: GetClusterLayoutResult;
};

export type GetHealthResult = {
  status: string;
  knownNodes: number;
  connectedNodes: number;
  storageNodes: number;
  storageNodesUp: number;
  partitions: number;
  partitionsQuorum: number;
  partitionsAllOk: number;
};
