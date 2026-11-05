import api from "@/lib/api";
import { useInvalidatingMutation } from "@/lib/mutation";
import { UseMutationOptions, useQuery } from "@tanstack/react-query";
import { GetBucketRes } from "./types";
import { CreateBucketSchema } from "./schema";

export const useBuckets = () => {
  return useQuery({
    queryKey: ["buckets"],
    queryFn: () => api.get<GetBucketRes>("/buckets"),
  });
};

export const useCreateBucket = (
  options?: UseMutationOptions<unknown, Error, CreateBucketSchema>,
) =>
  useInvalidatingMutation(
    (body: CreateBucketSchema) =>
      api.post<unknown>("/v2/CreateBucket", { body }),
    // The shell (sidebar, breadcrumbs, palette) and the keys page read this list too.
    (queryClient) => {
      void queryClient.invalidateQueries({ queryKey: ["buckets"] });
    },
    options,
  );
