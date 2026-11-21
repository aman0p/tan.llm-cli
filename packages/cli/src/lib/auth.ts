import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthData = {
  token: string;
  refreshToken?: string;
  expiresAt?: number;
  openRouterApiKey?: string;
};

const AUTH_DIR = join(homedir(), ".nightcode");
const AUTH_FILE = join(AUTH_DIR, "auth.json");

function readAuthFile(): (Partial<AuthData> & { openRouterApiKey?: string }) | null {
  try {
    return JSON.parse(readFileSync(AUTH_FILE, "utf-8")) as Partial<AuthData>;
  } catch {
    return null;
  }
}

export function getAuth(): AuthData | null {
  const parsed = readAuthFile();
  return typeof parsed?.token === "string" && parsed.token.length > 0
    ? {
        token: parsed.token,
        ...(typeof parsed.refreshToken === "string" ? { refreshToken: parsed.refreshToken } : {}),
        ...(typeof parsed.expiresAt === "number" ? { expiresAt: parsed.expiresAt } : {}),
        ...(typeof parsed.openRouterApiKey === "string" ? { openRouterApiKey: parsed.openRouterApiKey } : {}),
      }
    : null;
}

function writeAuth(data: AuthData) {
  if (!existsSync(AUTH_DIR)) {
    // Owner-only permissions (rwx------) so other users on the machine can't read tokens
    mkdirSync(AUTH_DIR, { mode: 0o700 });
  }
  writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}

export function saveAuth(data: AuthData) {
  writeAuth(data);
}

export function updateAuth(patch: Partial<AuthData>): AuthData | null {
  const current = getAuth();
  if (!current) return null;

  const next = { ...current, ...patch };
  writeAuth(next);
  return next;
}

export function setTokens(token: string, refreshToken?: string, expiresAt?: number) {
  const current = readAuthFile();
  writeAuth({
    token,
    ...(refreshToken ? { refreshToken } : {}),
    ...(typeof expiresAt === "number" ? { expiresAt } : {}),
    ...(typeof current?.openRouterApiKey === "string"
      ? { openRouterApiKey: current.openRouterApiKey }
      : {}),
  });
}

export function clearAuth() {
  try {
    unlinkSync(AUTH_FILE);
  } catch {
    // File doesn't exist
  }
}

export function clearTokens() {
  const current = getAuth();
  if (!current?.openRouterApiKey) {
    clearAuth();
    return;
  }

  writeAuth({ token: "", openRouterApiKey: current.openRouterApiKey });
}

export function getOpenRouterApiKey() {
  return readAuthFile()?.openRouterApiKey?.trim() || null;
}

export function saveOpenRouterApiKey(apiKey: string) {
  const key = apiKey.trim();
  const current = readAuthFile();

  writeAuth({
    token: typeof current?.token === "string" ? current.token : "",
    ...(typeof current?.refreshToken === "string" ? { refreshToken: current.refreshToken } : {}),
    ...(typeof current?.expiresAt === "number" ? { expiresAt: current.expiresAt } : {}),
    openRouterApiKey: key,
  });
}
