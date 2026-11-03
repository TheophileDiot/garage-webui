import * as utils from "@/lib/utils";
import { BASE_PATH } from "./consts";

type FetchOptions = Omit<RequestInit, "headers" | "body"> & {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
};

export const API_URL = BASE_PATH + "/api";

export class APIError extends Error {
  status!: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "APIError";
    this.status = status;
  }
}

const api = {
  async fetch<T = unknown>(url: string, options?: Partial<FetchOptions>) {
    const { params, body, headers: extraHeaders, ...init } = options ?? {};
    const headers: Record<string, string> = {
      "X-Requested-With": "garage-webui",
    };
    const _url = new URL(API_URL + url, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        _url.searchParams.set(key, String(value));
      });
    }

    let payload: BodyInit | null | undefined;
    if (typeof body === "object" && !(body instanceof FormData)) {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    } else {
      payload = body as BodyInit | null | undefined;
    }

    const res = await fetch(_url, {
      ...init,
      body: payload,
      credentials: "include",
      headers: { ...headers, ...(extraHeaders || {}) },
    });

    const isJson = res.headers
      .get("Content-Type")
      ?.includes("application/json");
    const data = isJson ? await res.json() : await res.text();

    if (res.status === 401 && !url.startsWith("/auth")) {
      window.location.href = utils.url("/auth/login");
      throw new APIError("unauthorized", res.status);
    }

    if (!res.ok) {
      const message = isJson
        ? data?.message
        : typeof data === "string"
          ? data
          : res.statusText;
      throw new APIError(message, res.status);
    }

    return data as unknown as T;
  },

  async get<T = unknown>(url: string, options?: Partial<FetchOptions>) {
    return this.fetch<T>(url, {
      ...options,
      method: "GET",
    });
  },

  async post<T = unknown>(url: string, options?: Partial<FetchOptions>) {
    return this.fetch<T>(url, {
      ...options,
      method: "POST",
    });
  },

  async put<T = unknown>(url: string, options?: Partial<FetchOptions>) {
    return this.fetch<T>(url, {
      ...options,
      method: "PUT",
    });
  },

  async delete<T = unknown>(url: string, options?: Partial<FetchOptions>) {
    return this.fetch<T>(url, {
      ...options,
      method: "DELETE",
    });
  },
};

export default api;
