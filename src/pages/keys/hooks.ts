import api from "@/lib/api";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Key } from "./types";
import { CreateKeySchema } from "./schema";

export const useKeys = () => {
  return useQuery({
    queryKey: ["keys"],
    queryFn: () => api.get<Key[]>("/v2/ListKeys"),
  });
};

/** Reads one key's secret on demand (never cached in a query). */
export const fetchSecretKey = async (id: string) => {
  const result = await api.get<{ secretAccessKey?: string }>("/v2/GetKeyInfo", {
    params: { id, showSecretKey: "true" },
  });
  if (!result?.secretAccessKey) throw new Error("Failed to fetch secret key");
  return result.secretAccessKey;
};

export const useCreateKey = (
  options?: UseMutationOptions<unknown, Error, CreateKeySchema>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      if (body.isImport) {
        return api.post("/v2/ImportKey", { body });
      }
      return api.post("/v2/CreateKey", { body });
    },
    ...options,
    onSuccess: async (...args) => {
      // The shell and the bucket pages read both lists.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["keys"] }),
        queryClient.invalidateQueries({ queryKey: ["buckets"] }),
      ]);
      return options?.onSuccess?.(...args);
    },
  });
};

export const useRemoveKey = (
  options?: UseMutationOptions<unknown, Error, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post("/v2/DeleteKey", { params: { id } }),
    ...options,
    onSuccess: async (...args) => {
      // A deleted key also leaves every bucket's grants, so bucket details go stale too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["keys"] }),
        queryClient.invalidateQueries({ queryKey: ["buckets"] }),
        queryClient.invalidateQueries({ queryKey: ["bucket"] }),
      ]);
      return options?.onSuccess?.(...args);
    },
  });
};
