export type UseBrowserObjectOptions = Partial<{
  prefix: string;
  limit: number;
  next: string;
}>;

export type GetObjectsResult = {
  prefixes: string[];
  objects: Object[];
  prefix: string;
  nextToken: string | null;
};

export type Object = {
  objectKey: string;
  lastModified: Date;
  size: number;
  url: string;
};

/**
 * What a row action works on. A file's `objectKey` is relative to `prefix` (the listing's prefix); a folder's is its
 * full prefix with an empty `prefix`. The full S3 key is always `prefix + objectKey`.
 */
export type ObjectTarget = {
  objectKey: string;
  prefix: string;
  url: string;
};

export type PutObjectPayload = {
  key: string;
  file: File | null;
};
