import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mode, type ModeType } from "@tan.llm/shared";
import { CONFIG_DIR } from "./config-dir";

const PREFERENCES_PATH = join(CONFIG_DIR, "preferences.json");

export type Density = "compact" | "comfortable";

export type Preferences = {
  themeName?: string;
  model?: string;
  mode?: ModeType;
  density?: Density;
  maxTokens?: number;
};

const MAX_MAX_TOKENS = 200_000;

function normalizeMaxTokens(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= MAX_MAX_TOKENS ? rounded : undefined;
}

export function getPreferences(): Preferences {
  try {
    const parsed = JSON.parse(readFileSync(PREFERENCES_PATH, "utf-8")) as Partial<Preferences>;
    const maxTokens = normalizeMaxTokens(parsed.maxTokens);
    return {
      ...(typeof parsed.themeName === "string" ? { themeName: parsed.themeName } : {}),
      ...(typeof parsed.model === "string" && parsed.model.length > 0
        ? { model: parsed.model }
        : {}),
      ...(parsed.mode === Mode.BUILD || parsed.mode === Mode.PLAN ? { mode: parsed.mode } : {}),
      ...(parsed.density === "compact" || parsed.density === "comfortable"
        ? { density: parsed.density }
        : {}),
      ...(maxTokens != null ? { maxTokens } : {}),
    };
  } catch {
    return {};
  }
}

export function updatePreferences(patch: Partial<Preferences>): Preferences {
  const current = getPreferences();
  const maxTokens = !("maxTokens" in patch)
    ? current.maxTokens
    : normalizeMaxTokens(patch.maxTokens);

  const next: Preferences = { ...current, ...patch };
  if (maxTokens == null) {
    delete next.maxTokens;
  } else {
    next.maxTokens = maxTokens;
  }

  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  writeFileSync(PREFERENCES_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}
