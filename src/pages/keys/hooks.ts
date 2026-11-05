import api from "@/lib/api";
import { useInvalidatingMutation } from "@/lib/mutation";
import { UseMutationOptions, useQuery } from "@tanstack/react-query";
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
) =>
  useInvalidatingMutation(
    async (body: CreateKeySchema) => {
      if (body.isImport) {
        return api.post("/v2/ImportKey", { body });
      }
      return api.post("/v2/CreateKey", { body });
    },
    // The shell and the bucket pages read both lists.
    (client) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["keys"] }),
        client.invalidateQueries({ queryKey: ["buckets"] }),
      ]),
    options,
  );

export const useRemoveKey = (
  options?: UseMutationOptions<unknown, Error, string>,
) =>
  useInvalidatingMutation(
    (id: string) => api.post("/v2/DeleteKey", { params: { id } }),
    // A deleted key also leaves every bucket's grants, so bucket details go stale too.
    (client) =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["keys"] }),
        client.invalidateQueries({ queryKey: ["buckets"] }),
        client.invalidateQueries({ queryKey: ["bucket"] }),
      ]),
    options,
  );
