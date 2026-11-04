import api from "@/lib/api";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post("/v2/CreateBucket", { body }),
    ...options,
    onSuccess: (...args) => {
      // The shell (address bar, palette) and the keys page read this list too.
      void queryClient.invalidateQueries({ queryKey: ["buckets"] });
      return options?.onSuccess?.(...args);
    },
  });
};
