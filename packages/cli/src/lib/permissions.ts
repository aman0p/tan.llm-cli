import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";

export type PermissionEffect = "allow" | "ask" | "deny";

export type PermissionRule = {
  action: string;
  resource: string;
  effect: PermissionEffect;
  source?: "default" | "config" | "saved";
};

export type PermissionConfig = {
  rules: PermissionRule[];
  paths: string[];
};

export type PermissionRequest = {
  action: string;
  resource: string;
  rule?: PermissionRule;
};

export type PermissionDecision = {
  effect: PermissionEffect;
  rule?: PermissionRule;
};

const ruleSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  effect: z.enum(["allow", "ask", "deny"]),
  source: z.enum(["default", "config", "saved"]).optional(),
});

const configSchema = z.object({
  permissions: z.array(ruleSchema).default([]),
  savedAllow: z.array(ruleSchema).default([]),
});

const DEFAULT_RULES: PermissionRule[] = [
  { action: "*", resource: "*", effect: "allow", source: "default" },
  { action: "read", resource: "*.env", effect: "ask", source: "default" },
  { action: "read", resource: "*.env.*", effect: "ask", source: "default" },
  { action: "read", resource: "*.env.example", effect: "allow", source: "default" },
];

const CACHE_MS = 1_000;

let cache: { at: number; cwd: string; config: PermissionConfig } | null = null;

function readConfig(path: string): z.infer<typeof configSchema> {
  if (!existsSync(path)) {
    return { permissions: [], savedAllow: [] };
  }

  try {
    return configSchema.parse(JSON.parse(readFileSync(path, "utf-8")));
  } catch {
    return { permissions: [], savedAllow: [] };
  }
}

function projectConfigPaths(): string[] {
  const paths: string[] = [];
  let current = process.cwd();

  while (true) {
    paths.push(join(current, ".tan.llm", "config.json"));
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return paths.reverse();
}

export function getPermissionConfigPaths(): string[] {
  return [join(homedir(), ".tan.llm", "config.json"), ...projectConfigPaths()];
}

function wildcardToRegExp(pattern: string): RegExp {
  let source = "^";
  for (const char of pattern) {
    if (char === "*") source += ".*";
    else if (char === "?") source += ".";
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${source}$`, "i");
}

function matches(pattern: string, value: string): boolean {
  const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();
  const normalizedValue = value.replace(/\\/g, "/").toLowerCase();

  const patterns = normalizedPattern.endsWith(" *")
    ? [normalizedPattern, normalizedPattern.slice(0, -2)]
    : [normalizedPattern];

  return patterns.some((candidate) => wildcardToRegExp(candidate).test(normalizedValue));
}

export function resolvePermission(
  config: PermissionConfig,
  action: string,
  resource: string,
): PermissionDecision {
  let decision: PermissionDecision = { effect: "allow" };
  let savedAllow: PermissionRule | undefined;

  for (const rule of config.rules) {
    if (!matches(rule.action, action) || !matches(rule.resource, resource)) continue;

    if (rule.source === "saved") {
      savedAllow = rule;
      continue;
    }

    decision = { effect: rule.effect, rule };
  }

  // A saved approval persists through "ask" rules, but never overrides an
  // explicit configured allow or deny.
  if (decision.effect === "ask" && savedAllow) {
    return { effect: "allow", rule: savedAllow };
  }

  return decision;
}

export function loadPermissions(): PermissionConfig {
  const now = Date.now();
  const cwd = process.cwd();

  if (cache && cache.cwd === cwd && now - cache.at < CACHE_MS) {
    return cache.config;
  }

  const paths = getPermissionConfigPaths();
  const rules: PermissionRule[] = [...DEFAULT_RULES];

  for (const path of paths) {
    const config = readConfig(path);
    rules.push(
      ...config.savedAllow.map((rule) => ({ ...rule, source: "saved" as const })),
      ...config.permissions.map((rule) => ({ ...rule, source: "config" as const })),
    );
  }

  const result: PermissionConfig = {
    rules,
    paths: paths.filter(existsSync),
  };

  cache = { at: now, cwd, config: result };
  return result;
}

export function saveAllowRule(rule: PermissionRule): void {
  const path = join(process.cwd(), ".tan.llm", "config.json");
  let raw: Record<string, unknown> = {};

  try {
    raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    // Start a fresh config when the file is missing or invalid.
  }

  const configured = ruleSchema.array().safeParse(raw.permissions);
  const explicitDeny = configured.success
    ? configured.data.some(
        (existing) =>
          existing.action === rule.action &&
          existing.resource === rule.resource &&
          existing.effect === "deny",
      )
    : false;

  if (explicitDeny) return;

  const saved = ruleSchema.array().safeParse(raw.savedAllow);
  const savedAllow: PermissionRule[] = saved.success ? saved.data : [];
  const savedRule: PermissionRule = {
    action: rule.action,
    resource: rule.resource,
    effect: "allow",
    source: "saved",
  };
  const duplicate = savedAllow.some(
    (existing) =>
      existing.action === savedRule.action &&
      existing.resource === savedRule.resource &&
      existing.effect === savedRule.effect,
  );

  if (!duplicate) {
    savedAllow.push(savedRule);
  }

  raw.savedAllow = savedAllow;

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
  clearPermissionCache();
}

export function clearPermissionCache(): void {
  cache = null;
}
