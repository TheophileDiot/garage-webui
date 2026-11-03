import api from "@/lib/api";
import { GetHealthResult } from "./types";
import { useQuery } from "@tanstack/react-query";

export const useNodesHealth = () => {
  return useQuery({
    queryKey: ["health"],
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
    queryFn: () => api.get<GetHealthResult>("/v2/GetClusterHealth"),
  });
};
