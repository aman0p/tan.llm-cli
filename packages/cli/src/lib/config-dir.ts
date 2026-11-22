import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".tan.llm");
const LEGACY_CONFIG_DIR = join(homedir(), ".nightcode");

// One-time migration so keys, custom models, and preferences survive the rename.
function migrateLegacyConfig() {
  if (existsSync(CONFIG_DIR) || !existsSync(LEGACY_CONFIG_DIR)) return;

  try {
    cpSync(LEGACY_CONFIG_DIR, CONFIG_DIR, { recursive: true });
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  } catch {
    // Best effort: a fresh config is still usable.
  }
}

migrateLegacyConfig();
