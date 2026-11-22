import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OpenRouterModel } from "@tan.llm/shared";
import { CONFIG_DIR } from "./config-dir";

const CUSTOM_MODELS_PATH = join(CONFIG_DIR, "custom-models.json");
const MAX_MAX_TOKENS = 200_000;

export type CustomModelEntry = {
  slug: string;
  maxTokens?: number;
};

type CustomModelsFile = {
  models?: unknown;
  slugs?: unknown;
};

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug.length > 0 && !/\s/.test(slug) ? slug : null;
}

function normalizeMaxTokens(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= MAX_MAX_TOKENS ? rounded : undefined;
}

function readEntries(): CustomModelEntry[] {
  try {
    const parsed = JSON.parse(readFileSync(CUSTOM_MODELS_PATH, "utf-8")) as CustomModelsFile;
    const entries: CustomModelEntry[] = [];

    if (Array.isArray(parsed.models)) {
      for (const item of parsed.models) {
        if (typeof item !== "object" || item == null) continue;
        const candidate = item as { slug?: unknown; maxTokens?: unknown };
        const slug = normalizeSlug(candidate.slug);
        if (!slug) continue;
        const maxTokens = normalizeMaxTokens(candidate.maxTokens);
        entries.push(maxTokens == null ? { slug } : { slug, maxTokens });
      }
    } else if (Array.isArray(parsed.slugs)) {
      for (const item of parsed.slugs) {
        const slug = normalizeSlug(item);
        if (slug) entries.push({ slug });
      }
    }

    const seen = new Set<string>();
    return entries.filter((entry) => {
      const key = entry.slug.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function writeEntries(entries: CustomModelEntry[]) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(
    CUSTOM_MODELS_PATH,
    JSON.stringify({ models: entries }, null, 2),
    { mode: 0o600 },
  );
}

export function getCustomModelEntries(): CustomModelEntry[] {
  return readEntries();
}

export function getCustomModels(): OpenRouterModel[] {
  return readEntries().map(({ slug }) => ({
    id: slug,
    name: `Custom: ${slug}`,
    contextLength: 0,
    promptPriceUsdPerToken: 0,
    completionPriceUsdPerToken: 0,
  }));
}

export function getMaxTokensForModel(slug: string): number | undefined {
  const target = slug.trim().toLowerCase();
  return readEntries().find((entry) => entry.slug.toLowerCase() === target)?.maxTokens;
}

export function addCustomModel(slug: string, maxTokens?: number): string {
  const clean = normalizeSlug(slug);
  if (!clean) {
    throw new Error("Enter a valid OpenRouter model slug, e.g. thinkingmachines/inkling-2-mini");
  }

  const normalizedMaxTokens = normalizeMaxTokens(maxTokens);
  if (maxTokens != null && normalizedMaxTokens == null) {
    throw new Error(`max tokens must be between 1 and ${MAX_MAX_TOKENS}`);
  }

  const entries = readEntries();
  const existing = entries.find((entry) => entry.slug.toLowerCase() === clean.toLowerCase());

  if (existing) {
    existing.maxTokens = normalizedMaxTokens;
  } else {
    entries.push(normalizedMaxTokens == null ? { slug: clean } : { slug: clean, maxTokens: normalizedMaxTokens });
  }

  writeEntries(entries);
  return clean;
}

export function setCustomModelMaxTokens(slug: string, maxTokens?: number) {
  addCustomModel(slug, maxTokens);
}
