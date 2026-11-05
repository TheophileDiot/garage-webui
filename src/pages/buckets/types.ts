//

export type GetBucketRes = Bucket[];

export type Bucket = {
  id: string;
  globalAliases: string[];
  localAliases: LocalAlias[];
  websiteAccess: boolean;
  websiteConfig?: WebsiteConfig | null;
  keys: Key[];
  objects: number;
  bytes: number;
  unfinishedUploads: number;
  unfinishedMultipartUploads: number;
  unfinishedMultipartUploadParts: number;
  unfinishedMultipartUploadBytes: number;
  quotas: Quotas;
};

type LocalAlias = {
  accessKeyId: string;
  alias: string;
};

export type Key = {
  accessKeyId: string;
  name: string;
  permissions: Permissions;
  bucketLocalAliases: string[];
};

export type Permissions = {
  read: boolean;
  write: boolean;
  owner: boolean;
};

type WebsiteConfig = {
  indexDocument: string;
  errorDocument: string;
};

/**
 * `null` = no quota. The app-owned `/api/buckets` list re-encodes Go int64 quotas, so there "no quota" can arrive
 * as `0`: list consumers treat `null` and `0` alike as no quota.
 */
type Quotas = {
  maxSize: number | null;
  maxObjects: number | null;
};
