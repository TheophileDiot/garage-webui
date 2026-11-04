import api from "@/lib/api";
import {
  ApplyLayoutResult,
  AssignNodeBody,
  GetClusterLayoutResult,
  GetNodeInfoResult,
  GetStatusResult,
  Node,
} from "./types";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

type ConnectNodeResult = { success: boolean; error?: string | null };

export const useNodeInfo = () => {
  return useQuery({
    queryKey: ["node-info"],
    queryFn: () =>
      api.get<GetNodeInfoResult>("/v2/GetNodeInfo", {
        params: { node: "self" },
      }),
    select: (data) => Object.values(data?.success || {})?.[0],
  });
};

export const useClusterStatus = () => {
  return useQuery({
    queryKey: ["status"],
    refetchInterval: 30_000,
    queryFn: () => api.get<GetStatusResult>("/v2/GetClusterStatus"),
  });
};

/** Nodes of a cluster status response, with their layout role when the API sends it apart. */
export const getStatusNodes = (data?: GetStatusResult): Node[] => {
  if (!data) return [];

  if (Array.isArray(data.knownNodes)) {
    return data.knownNodes.map((node) => ({
      ...node,
      role: data.layout?.roles.find((role) => role.id === node.id),
    }));
  }

  return data.nodes || [];
};

export const useClusterLayout = () => {
  return useQuery({
    queryKey: ["layout"],
    queryFn: () => api.get<GetClusterLayoutResult>("/v2/GetClusterLayout"),
  });
};

/**
 * Every cluster mutation refreshes what the shell and the other pages read: status (nodes, address bar, palette),
 * layout (staged changes) and health (map, status glyph). The caller's own `onSuccess` runs after.
 */
const useClusterMutation = <TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options?: Partial<UseMutationOptions<TData, Error, TVars>>,
) => {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn,
    ...options,
    onSuccess: async (...args) => {
      await Promise.all(
        ["status", "layout", "health"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      return (
        options?.onSuccess as ((...a: typeof args) => unknown) | undefined
      )?.(...args);
    },
  });
};

export const useConnectNode = (
  options?: Partial<UseMutationOptions<ConnectNodeResult, Error, string>>,
) =>
  useClusterMutation<ConnectNodeResult, string>(async (nodeId) => {
    const [res] = await api.post<ConnectNodeResult[]>(
      "/v2/ConnectClusterNodes",
      { body: [nodeId] },
    );
    if (!res?.success) {
      throw new Error(res?.error || "Unknown error");
    }
    return res;
  }, options);

export const useAssignNode = (
  options?: Partial<UseMutationOptions<unknown, Error, AssignNodeBody>>,
) =>
  useClusterMutation<unknown, AssignNodeBody>(
    (data) =>
      api.post("/v2/UpdateClusterLayout", {
        body: { parameters: null, roles: [data] },
      }),
    options,
  );

export const useUnassignNode = (
  options?: Partial<UseMutationOptions<unknown, Error, string>>,
) =>
  useClusterMutation<unknown, string>(
    (nodeId) =>
      api.post("/v2/UpdateClusterLayout", {
        body: { parameters: null, roles: [{ id: nodeId, remove: true }] },
      }),
    options,
  );

export const useRevertChanges = (
  options?: Partial<UseMutationOptions<unknown, Error, number>>,
) =>
  useClusterMutation<unknown, number>(
    () => api.post("/v2/RevertClusterLayout"),
    options,
  );

export const useApplyChanges = (
  options?: Partial<UseMutationOptions<ApplyLayoutResult, Error, number>>,
) =>
  useClusterMutation<ApplyLayoutResult, number>(
    (version) => api.post("/v2/ApplyClusterLayout", { body: { version } }),
    options,
  );
