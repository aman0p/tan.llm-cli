import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { OpenRouterModel } from "@nightcode/shared";

const CONFIG_DIR = join(homedir(), ".nightcode");
const CUSTOM_MODELS_PATH = join(CONFIG_DIR, "custom-models.json");

type CustomModelsFile = {
  slugs?: unknown;
};

function readSlugs(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(CUSTOM_MODELS_PATH, "utf-8")) as CustomModelsFile;
    if (!Array.isArray(parsed.slugs)) return [];

    const slugs = parsed.slugs
      .filter((slug): slug is string => typeof slug === "string")
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0 && !/\s/.test(slug));

    return [...new Set(slugs)];
  } catch {
    return [];
  }
}

function writeSlugs(slugs: string[]) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CUSTOM_MODELS_PATH, JSON.stringify({ slugs }, null, 2), { mode: 0o600 });
}

export function getCustomModels(): OpenRouterModel[] {
  return readSlugs().map((slug) => ({
    id: slug,
    name: `Custom: ${slug}`,
    contextLength: 0,
    promptPriceUsdPerToken: 0,
    completionPriceUsdPerToken: 0,
  }));
}

export function addCustomModel(slug: string): string {
  const clean = slug.trim();
  if (!clean || /\s/.test(clean)) {
    throw new Error("Enter a valid OpenRouter model slug, e.g. thinkingmachines/inkling-2-mini");
  }

  const slugs = readSlugs();
  if (!slugs.some((saved) => saved.toLowerCase() === clean.toLowerCase())) {
    writeSlugs([...slugs, clean]);
  }

  return clean;
}
