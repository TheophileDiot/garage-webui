import api from "@/lib/api";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useBucketContext } from "../context";
import {
  GetObjectsResult,
  PutObjectPayload,
  UseBrowserObjectOptions,
} from "./types";

export const useBrowseObjects = (
  bucket: string,
  options?: UseBrowserObjectOptions,
) => {
  return useQuery({
    queryKey: ["browse", bucket, options],
    queryFn: () =>
      api.get<GetObjectsResult>(`/browse/${bucket}`, { params: options }),
  });
};

/** The bucket a browse write targets, and the refresh that follows it: the listing, plus the bucket list and detail that carry object counts and bytes. */
const useBrowseWrite = () => {
  const queryClient = useQueryClient();
  const { bucket, bucketName } = useBucketContext();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["browse", bucketName] }),
      queryClient.invalidateQueries({ queryKey: ["buckets"] }),
      queryClient.invalidateQueries({ queryKey: ["bucket", bucket.id] }),
    ]);
  return { bucketName, invalidate };
};

export const usePutObject = (
  options?: UseMutationOptions<unknown, Error, PutObjectPayload>,
) => {
  const { bucketName, invalidate } = useBrowseWrite();
  return useMutation({
    mutationFn: async (body) => {
      const formData = new FormData();
      if (body.file) {
        formData.append("file", body.file);
      }

      return api.put(`/browse/${bucketName}/${encodeURIComponent(body.key)}`, {
        body: formData,
      });
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};

export const useDeleteObject = (
  options?: UseMutationOptions<
    unknown,
    Error,
    { key: string; recursive?: boolean }
  >,
) => {
  const { bucketName, invalidate } = useBrowseWrite();
  return useMutation({
    mutationFn: (data) =>
      api.delete(`/browse/${bucketName}/${encodeURIComponent(data.key)}`, {
        params: { recursive: data.recursive },
      }),
    ...options,
    onSuccess: async (...args) => {
      await invalidate();
      return options?.onSuccess?.(...args);
    },
  });
};
