import { getAuth, getOpenRouterApiKey } from "./auth";
import { getCustomModelEntries, getMaxTokensForModel } from "./custom-models";
import { getPreferences } from "./preferences";
import { getValidAccessToken } from "./tokens";

export type DoctorStatus = "ok" | "warn" | "error" | "info";

export type DoctorResult = {
  label: string;
  status: DoctorStatus;
  detail: string;
  hint?: string;
};

const API_URL = (process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TIMEOUT_MS = 8_000;
const IS_LOCAL_API = /localhost|127\.0\.0\.1/.test(API_URL);

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`request failed with status ${response.status}`);
  return (await response.json()) as T;
}

export async function runDoctor(): Promise<DoctorResult[]> {
  const results: DoctorResult[] = [];
  const preferences = getPreferences();
  const apiKey = getOpenRouterApiKey();

  try {
    const models = await fetchJson<Array<{ id: string }>>(`${API_URL}/models`);
    results.push({
      label: "Server",
      status: "ok",
      detail: `${API_URL} responded with ${models.length} models`,
    });

    const selectedModel = preferences.model;
    if (!selectedModel) {
      results.push({
        label: "Model",
        status: "error",
        detail: "No model selected",
        hint: "Run /models or /model to choose one",
      });
    } else {
      const isCustom = getCustomModelEntries().some(
        (entry) => entry.slug.toLowerCase() === selectedModel.toLowerCase(),
      );
      const isCatalog = models.some((model) => model.id === selectedModel);

      if (isCatalog || isCustom) {
        results.push({
          label: "Model",
          status: "ok",
          detail: selectedModel + (isCustom ? " (custom)" : ""),
        });
      } else {
        results.push({
          label: "Model",
          status: "warn",
          detail: `${selectedModel} is not in the current catalog`,
          hint: "Verify the slug at openrouter.ai/models or run /models",
        });
      }

      const maxTokens = getMaxTokensForModel(selectedModel) ?? preferences.maxTokens;
      if (maxTokens == null) {
        results.push({
          label: "Max tokens",
          status: "info",
          detail: "Using the model default",
          hint: "Run /max-tokens to set a lower limit if you hit credit errors",
        });
      } else {
        results.push({
          label: "Max tokens",
          status: maxTokens > 32_768 ? "warn" : "ok",
          detail: `${maxTokens} tokens`,
          hint: maxTokens > 32_768 ? "Lower this if OpenRouter reports insufficient credits" : undefined,
        });
      }
    }
  } catch (error) {
    results.push({
      label: "Server",
      status: "error",
      detail: `Cannot reach ${API_URL}: ${error instanceof Error ? error.message : "unknown error"}`,
      hint: IS_LOCAL_API
        ? "Run bun run dev:server and check the port"
        : "Check API_URL and that the deployed server is running",
    });
  }

  try {
    const token = await getValidAccessToken();
    if (!token) {
      results.push({
        label: "Auth",
        status: "error",
        detail: "Not signed in",
        hint: "Run /login to sign in again",
      });
    } else {
      results.push({ label: "Auth", status: "ok", detail: "Access token is valid" });

      try {
        const response = await fetch(`${API_URL}/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (response.status === 401) {
          results.push({
            label: "Server auth",
            status: "error",
            detail: "Server rejected the access token",
            hint: "Check NEON_AUTH_BASE_URL and NEON_AUTH_RESOURCE on the server, then redeploy",
          });
        } else if (!response.ok) {
          results.push({
            label: "Server auth",
            status: "warn",
            detail: `Server returned status ${response.status}`,
            hint: "Check the server logs and that db:push was run",
          });
        } else {
          results.push({
            label: "Server auth",
            status: "ok",
            detail: "Server accepted the access token",
          });
        }
      } catch (error) {
        results.push({
          label: "Server auth",
          status: "warn",
          detail: `Could not check server auth: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  } catch {
    results.push({
      label: "Auth",
      status: getAuth()?.token ? "warn" : "error",
      detail: getAuth()?.token ? "Token is missing or expired" : "Not signed in",
      hint: "Run /login to sign in again",
    });
  }

  if (apiKey) {
    try {
      const credits = await fetchJson<{
        data?: { total_credits?: number; total_usage?: number };
      }>("https://openrouter.ai/api/v1/credits", {
        Authorization: `Bearer ${apiKey}`,
      });
      const total = credits.data?.total_credits ?? 0;
      const used = credits.data?.total_usage ?? 0;
      const remaining = total - used;

      results.push({
        label: "OpenRouter credits",
        status: remaining <= 1 ? "warn" : "ok",
        detail: `$${remaining.toFixed(2)} remaining`,
        hint: remaining <= 1 ? "Add credits at openrouter.ai/settings/credits" : undefined,
      });
    } catch (error) {
      results.push({
        label: "OpenRouter credits",
        status: "info",
        detail: `Could not fetch credit balance: ${error instanceof Error ? error.message : "unknown error"}`,
        hint: "Check that /set-key used a valid OpenRouter API key",
      });
    }
  } else {
    results.push({
      label: "OpenRouter key",
      status: "warn",
      detail: "No CLI key found",
      hint: "Run /set-key or set OPENROUTER_API_KEY on the server",
    });
  }

  return results;
}
