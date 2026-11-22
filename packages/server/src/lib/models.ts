import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { OpenRouterModel } from "@tan.llm/shared";

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

type OpenRouterApiModel = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
};

type CachedModels = {
  fetchedAt: number;
  models: OpenRouterModel[];
};

let cached: CachedModels | null = null;
let pendingFetch: Promise<OpenRouterModel[]> | null = null;

export function resolveChatModel(modelId: string, apiKey: string): LanguageModel {
  const openrouter = createOpenRouter({ apiKey });
  return openrouter.chat(modelId);
}

async function fetchModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(MODELS_URL, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data?: OpenRouterApiModel[] };

  return (payload.data ?? [])
    .filter((model) => typeof model.id === "string" && !model.id.endsWith(":batch"))
    .filter((model) => (model.supported_parameters ?? []).includes("tools"))
    .map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      contextLength: model.context_length ?? 0,
      promptPriceUsdPerToken: Number(model.pricing?.prompt ?? 0),
      completionPriceUsdPerToken: Number(model.pricing?.completion ?? 0),
    }))
    .filter((model) => Number.isFinite(model.promptPriceUsdPerToken) && Number.isFinite(model.completionPriceUsdPerToken));
}

export function getOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cached.models);
  }

  if (!pendingFetch) {
    pendingFetch = fetchModels()
      .then((models) => {
        cached = { fetchedAt: Date.now(), models };
        return models;
      })
      .catch((error: unknown) => {
        if (cached) return cached.models;
        throw error;
      })
      .finally(() => {
        pendingFetch = null;
      });
  }

  return pendingFetch;
}
