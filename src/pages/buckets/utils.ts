import { Bucket } from "./types";

/** Display name of a bucket: first global alias, else first local alias, else its id. */
export const bucketName = (
  bucket: Pick<Bucket, "id" | "globalAliases" | "localAliases">,
) => bucket.globalAliases?.[0] || bucket.localAliases?.[0]?.alias || bucket.id;
