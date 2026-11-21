import { hc } from "hono/client";
import type { AppType } from "@nightcode/server";
import { clearTokens, getOpenRouterApiKey } from "./auth";
import { getValidAccessToken, refreshAccessToken } from "./tokens";

export const apiClient = hc<AppType>(
  process.env.API_URL ?? "http://localhost:3000",
  {
    fetch: async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      const headers = new Headers(init?.headers);
      const token = await getValidAccessToken();

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const apiKey = getOpenRouterApiKey();
      if (apiKey) {
        headers.set("x-openrouter-api-key", apiKey);
      }

      let response = await fetch(input, { ...init, headers });

      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          headers.set("Authorization", `Bearer ${refreshed}`);
          response = await fetch(input, { ...init, headers });
        }

        if (response.status === 401) {
          clearTokens();
        }
      }

      return response;
    }
  }
);
