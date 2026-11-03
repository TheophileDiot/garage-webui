import api from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type AuthResponse = {
  enabled: boolean;
  authenticated: boolean;
  local: boolean;
  oidc: boolean;
  displayName?: string;
};

export const useAuth = () => {
  const query = useQuery({
    queryKey: ["auth"],
    queryFn: () => api.get<AuthResponse>("/auth/status"),
    retry: false,
    staleTime: 30_000,
  });
  return {
    isLoading: query.isPending,
    error: query.error,
    retry: query.refetch,
    isEnabled: query.data?.enabled,
    isAuthenticated: query.data?.authenticated,
    localEnabled: query.data?.local,
    oidcEnabled: query.data?.oidc,
    displayName: query.data?.displayName,
  };
};
