import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { SkillSummary } from "@tan.llm/shared";

export type DiscoveredSkill = SkillSummary & {
  absolutePath: string;
  content: string;
  hidden: boolean;
  truncated: boolean;
};

type Frontmatter = {
  attrs: Record<string, string>;
  raw: string;
  body: string;
};

const MAX_SKILLS = 50;
const MAX_DESCRIPTION = 500;
const MAX_NAME = 100;
const MAX_CONTENT = 16_000;
const CACHE_MS = 2_000;

const SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const PROJECT_SOURCE_NAMES = [
  ".tan.llm/skills",
  ".opencode/skills",
  ".claude/skills",
  ".agents/skills",
];

const GLOBAL_SOURCE_NAMES = [
  ".tan.llm/skills",
  ".config/opencode/skills",
  ".claude/skills",
  ".agents/skills",
];

let cache: { at: number; cwd: string; skills: DiscoveredSkill[] } | null = null;

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function parseFrontmatter(source: string): Frontmatter | null {
  if (!source.startsWith("---")) return null;

  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const attrs: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!field) continue;
    attrs[field[1]!.toLowerCase()] = field[2]!.trim().replace(/^["']|["']$/g, "");
  }

  return { attrs, raw: match[1]!, body: match[2]!.trim() };
}

function addSkill(
  id: string,
  filePath: string,
  skills: Map<string, DiscoveredSkill>,
): void {
  if (!SKILL_ID_PATTERN.test(id)) return;

  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const frontmatter = parseFrontmatter(source);
  if (!frontmatter) return;

  const description = clean(frontmatter.attrs.description ?? "", MAX_DESCRIPTION);
  if (!description) return;

  const content = frontmatter.body;
  if (!content) return;

  const truncated = content.length > MAX_CONTENT;
  const hidden =
    /opencode\/autoinvoke\s*:\s*false/i.test(frontmatter.raw) ||
    /disable-model-invocation\s*:\s*true/i.test(frontmatter.raw);

  skills.set(id, {
    id,
    name: clean(frontmatter.attrs.name ?? id, MAX_NAME) || id,
    description,
    content: truncated ? content.slice(0, MAX_CONTENT) : content,
    absolutePath: filePath,
    hidden,
    truncated,
  });
}

function scanSource(sourceDir: string, skills: Map<string, DiscoveredSkill>): void {
  if (!existsSync(sourceDir)) return;

  let entries;
  try {
    entries = readdirSync(sourceDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    if (entry.isFile() && entry.name.endsWith(".md")) {
      addSkill(entry.name.slice(0, -3), join(sourceDir, entry.name), skills);
      continue;
    }

    if (entry.isDirectory()) {
      const skillPath = join(sourceDir, entry.name, "SKILL.md");
      if (existsSync(skillPath)) {
        addSkill(entry.name, skillPath, skills);
      }
    }
  }
}

function projectSourceDirs(): string[] {
  const dirs: string[] = [];
  let current = process.cwd();

  while (true) {
    for (const relative of PROJECT_SOURCE_NAMES) {
      dirs.push(join(current, relative));
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Load from the project root toward the current directory so nearer skills win.
  return dirs.reverse();
}

export function discoverSkills(): DiscoveredSkill[] {
  const now = Date.now();
  const cwd = process.cwd();

  if (cache && cache.cwd === cwd && now - cache.at < CACHE_MS) {
    return cache.skills;
  }

  const skills = new Map<string, DiscoveredSkill>();
  const sources: string[] = [];

  for (const relative of GLOBAL_SOURCE_NAMES) {
    sources.push(join(homedir(), relative));
  }
  sources.push(...projectSourceDirs());

  for (const source of sources) {
    scanSource(source, skills);
    if (skills.size >= MAX_SKILLS) break;
  }

  const discovered = Array.from(skills.values()).slice(0, MAX_SKILLS);
  cache = { at: now, cwd, skills: discovered };
  return discovered;
}

export function clearSkillCache(): void {
  cache = null;
}

export function getSkillSummaries(skills: DiscoveredSkill[]): SkillSummary[] {
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
  }));
}
