import api from "@/lib/api";
import { useInvalidatingMutation } from "@/lib/mutation";
import {
  QueryClient,
  UseMutationOptions,
  useQuery,
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

/** The refresh that follows a browse write: the listing, plus the bucket list and detail that carry object counts and bytes. */
const useBrowseRefresh = () => {
  const { bucket, globalAlias } = useBucketContext();
  return {
    globalAlias,
    refresh: (queryClient: QueryClient) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["browse", globalAlias] }),
        queryClient.invalidateQueries({ queryKey: ["buckets"] }),
        queryClient.invalidateQueries({ queryKey: ["bucket", bucket.id] }),
      ]),
  };
};

export const usePutObject = (
  options?: UseMutationOptions<unknown, Error, PutObjectPayload>,
) => {
  const { globalAlias, refresh } = useBrowseRefresh();
  return useInvalidatingMutation(
    async (body: PutObjectPayload) => {
      const formData = new FormData();
      if (body.file) {
        formData.append("file", body.file);
      }

      return api.put<unknown>(
        `/browse/${globalAlias}/${encodeURIComponent(body.key)}`,
        { body: formData },
      );
    },
    refresh,
    options,
  );
};

export const useDeleteObject = (
  options?: UseMutationOptions<
    unknown,
    Error,
    { key: string; recursive?: boolean }
  >,
) => {
  const { globalAlias, refresh } = useBrowseRefresh();
  return useInvalidatingMutation(
    (data: { key: string; recursive?: boolean }) =>
      api.delete<unknown>(
        `/browse/${globalAlias}/${encodeURIComponent(data.key)}`,
        { params: { recursive: data.recursive } },
      ),
    refresh,
    options,
  );
};
