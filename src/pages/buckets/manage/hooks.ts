import api from "@/lib/api";
import { useInvalidatingMutation } from "@/lib/mutation";
import {
  QueryClient,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Bucket, Permissions } from "../types";

type UpdateBucketBody = {
  quotas?: { maxObjects: number | null; maxSize: number | null };
  websiteAccess?: {
    enabled?: boolean;
    indexDocument?: string;
    errorDocument?: string;
  };
};

type KeyGrant = { keyId: string; permissions: Permissions };

/** Refreshes everything that shows this bucket: the list (page, shell, keys page) and its detail. */
const invalidateBucket = (queryClient: QueryClient, id?: string | null) => {
  void queryClient.invalidateQueries({ queryKey: ["buckets"] });
  void queryClient.invalidateQueries({ queryKey: ["bucket", id] });
};

export const useBucket = (id?: string | null) => {
  return useQuery({
    queryKey: ["bucket", id],
    queryFn: () => api.get<Bucket>("/v2/GetBucketInfo", { params: { id } }),
    enabled: !!id,
  });
};

export const useUpdateBucket = (
  id?: string | null,
  options?: UseMutationOptions<unknown, Error, UpdateBucketBody>,
) => {
  return useInvalidatingMutation(
    (values: UpdateBucketBody) =>
      api.post<unknown>("/v2/UpdateBucket", { params: { id }, body: values }),
    (queryClient) => invalidateBucket(queryClient, id),
    options,
  );
};

export const useAddAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  return useInvalidatingMutation(
    (alias: string) =>
      api.post<unknown>("/v2/AddBucketAlias", {
        body: { bucketId, globalAlias: alias },
      }),
    (queryClient) => invalidateBucket(queryClient, bucketId),
    options,
  );
};

export const useRemoveAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  return useInvalidatingMutation(
    (alias: string) =>
      api.post<unknown>("/v2/RemoveBucketAlias", {
        body: { bucketId, globalAlias: alias },
      }),
    (queryClient) => invalidateBucket(queryClient, bucketId),
    options,
  );
};

export const useAllowKey = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, KeyGrant[]>,
) => {
  const queryClient = useQueryClient();
  return useInvalidatingMutation(
    async (payload: KeyGrant[]) => {
      const promises = payload.map(async (key) => {
        return api.post("/v2/AllowBucketKey", {
          body: {
            bucketId,
            accessKeyId: key.keyId,
            permissions: key.permissions,
          },
        });
      });
      // Wait for every grant to settle: a fail-fast reject would refresh the bucket while others are still in flight.
      const settled = await Promise.allSettled(promises);
      const failed = settled.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failed.length > 0) {
        const first = (failed[0].reason as Error)?.message || "Request failed";
        throw new Error(
          failed.length === settled.length
            ? first
            : `${failed.length} of ${settled.length} grants failed: ${first}`,
        );
      }
      return settled.map((r) => (r as PromiseFulfilledResult<unknown>).value);
    },
    (client) => invalidateBucket(client, bucketId),
    {
      ...options,
      // Some grants may have gone through before another failed: show the truth.
      onError: (...args) => {
        invalidateBucket(queryClient, bucketId);
        return options?.onError?.(...args);
      },
    },
  );
};

export const useDenyKey = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, KeyGrant>,
) => {
  return useInvalidatingMutation(
    (payload: KeyGrant) =>
      api.post<unknown>("/v2/DenyBucketKey", {
        body: {
          bucketId,
          accessKeyId: payload.keyId,
          permissions: payload.permissions,
        },
      }),
    (queryClient) => invalidateBucket(queryClient, bucketId),
    options,
  );
};

export const useRemoveBucket = (
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  return useInvalidatingMutation(
    (id: string) => api.post<unknown>("/v2/DeleteBucket", { params: { id } }),
    (queryClient, id) => {
      void queryClient.invalidateQueries({ queryKey: ["buckets"] });
      // Mark the detail stale without refetching a bucket that no longer exists.
      void queryClient.invalidateQueries({
        queryKey: ["bucket", id],
        refetchType: "none",
      });
    },
    options,
  );
};
