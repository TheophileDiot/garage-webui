import api from "@/lib/api";
import {
  useMutation,
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
const useInvalidateBucket = (id?: string | null) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["buckets"] }),
      queryClient.invalidateQueries({ queryKey: ["bucket", id] }),
    ]);
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
  const invalidate = useInvalidateBucket(id);
  return useMutation({
    mutationFn: (values: UpdateBucketBody) => {
      return api.post<unknown>("/v2/UpdateBucket", {
        params: { id },
        body: values,
      });
    },
    ...options,
    onSuccess: (...args) => {
      void invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};

export const useAddAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  const invalidate = useInvalidateBucket(bucketId);
  return useMutation({
    mutationFn: (alias: string) => {
      return api.post("/v2/AddBucketAlias", {
        body: { bucketId, globalAlias: alias },
      });
    },
    ...options,
    onSuccess: (...args) => {
      void invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};

export const useRemoveAlias = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  const invalidate = useInvalidateBucket(bucketId);
  return useMutation({
    mutationFn: (alias: string) => {
      return api.post("/v2/RemoveBucketAlias", {
        body: { bucketId, globalAlias: alias },
      });
    },
    ...options,
    onSuccess: (...args) => {
      void invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};

export const useAllowKey = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, KeyGrant[]>,
) => {
  const invalidate = useInvalidateBucket(bucketId);
  return useMutation({
    mutationFn: async (payload: KeyGrant[]) => {
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
    ...options,
    onSuccess: (...args) => {
      void invalidate();
      return options?.onSuccess?.(...args);
    },
    // Some grants may have gone through before another failed: show the truth.
    onError: (...args) => {
      void invalidate();
      return options?.onError?.(...args);
    },
  });
};

export const useDenyKey = (
  bucketId?: string | null,
  options?: UseMutationOptions<unknown, Error, KeyGrant>,
) => {
  const invalidate = useInvalidateBucket(bucketId);
  return useMutation({
    mutationFn: (payload: KeyGrant) => {
      return api.post("/v2/DenyBucketKey", {
        body: {
          bucketId,
          accessKeyId: payload.keyId,
          permissions: payload.permissions,
        },
      });
    },
    ...options,
    onSuccess: (...args) => {
      void invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};

export const useRemoveBucket = (
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post("/v2/DeleteBucket", { params: { id } }),
    ...options,
    onSuccess: (...args) => {
      const [, id] = args;
      void queryClient.invalidateQueries({ queryKey: ["buckets"] });
      // Mark the detail stale without refetching a bucket that no longer exists.
      void queryClient.invalidateQueries({
        queryKey: ["bucket", id],
        refetchType: "none",
      });
      return options?.onSuccess?.(...args);
    },
  });
};
