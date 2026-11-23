import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "path";
import {
  toolInputSchemas,
  Mode,
  type ModeType,
  type QuestionInput,
  type QuestionOutput,
} from "@tan.llm/shared";
import type { DiscoveredSkill } from "./skills";
import {
  resolvePermission,
  saveAllowRule,
  type PermissionConfig,
  type PermissionRule,
} from "./permissions";

const MAX_FILE_SIZE = 10_000;
const MAX_RESULTS = 200;
const MAX_MATCHES = 50;
const MAX_OUTPUT = 20_000;
const DEFAULT_TIMEOUT = 30_000;

const PERMISSION_ACTIONS: Record<string, string> = {
  readFile: "read",
  listDirectory: "read",
  glob: "glob",
  grep: "grep",
  writeFile: "edit",
  editFile: "edit",
  bash: "shell",
  loadSkill: "skill",
  question: "question",
};

const PLAN_ALLOWED_TOOLS = new Set([
  "readFile",
  "listDirectory",
  "glob",
  "grep",
  "loadSkill",
  "question",
]);

export type PermissionChoice = "once" | "always" | "reject";

export type ToolExecutionContext = {
  mode: ModeType;
  skills: DiscoveredSkill[];
  permissions: PermissionConfig;
  askPermission: (request: {
    action: string;
    resource: string;
    rule?: PermissionRule;
  }) => Promise<PermissionChoice>;
  askQuestion: (input: QuestionInput) => Promise<QuestionOutput>;
  onAllowAlways?: (rule: PermissionRule) => void;
};

function asRecord(input: unknown): Record<string, unknown> {
  return input != null && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function relativeResource(value: unknown): string {
  const raw = typeof value === "string" && value.length > 0 ? value : ".";
  const rel = relative(process.cwd(), resolve(process.cwd(), raw));
  return rel.replace(/\\/g, "/") || ".";
}

function toolResource(toolName: string, input: unknown): { action: string; resource: string } {
  const values = asRecord(input);
  const action = PERMISSION_ACTIONS[toolName] ?? toolName;

  switch (toolName) {
    case "readFile":
    case "listDirectory":
    case "writeFile":
    case "editFile":
      return { action, resource: relativeResource(values.path) };
    case "glob":
    case "grep":
      return { action, resource: relativeResource(values.path) };
    case "bash":
      return { action, resource: typeof values.command === "string" ? values.command : "" };
    case "loadSkill":
      return { action, resource: typeof values.id === "string" ? values.id : "" };
    case "question":
      return { action, resource: "*" };
    default:
      return { action, resource: "*" };
  }
}

async function enforcePermission(
  toolName: string,
  input: unknown,
  ctx: ToolExecutionContext,
): Promise<void> {
  const { action, resource } = toolResource(toolName, input);
  const decision = resolvePermission(ctx.permissions, action, resource);

  if (decision.effect === "deny") {
    throw new Error(`Permission denied: ${action} ${resource}`.trim());
  }

  if (decision.effect !== "ask") return;

  const answer = await ctx.askPermission({
    action,
    resource,
    ...(decision.rule ? { rule: decision.rule } : {}),
  });

  if (answer === "reject") {
    throw new Error(`Permission rejected: ${action} ${resource}`.trim());
  }

  if (answer === "always") {
    const rule: PermissionRule = { action, resource, effect: "allow" };
    saveAllowRule(rule);
    ctx.onAllowAlways?.(rule);
  }
}

function resolveInsideCwd(path: string) {
  const cwd = process.cwd();
  const resolved = resolve(cwd, path);
  const rel = relative(cwd, resolved);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Path is outside the project directory");
  }

  return { cwd, resolved };
}

function truncate(value: string, limit: number) {
  return value.length > limit
    ? `${value.slice(0, limit)}\n... (truncated, ${value.length} total chars)`
    : value;
}

export async function executeLocalTool(
  toolName: string,
  input: unknown,
  ctx: ToolExecutionContext,
) {
  if (ctx.mode === Mode.PLAN && !PLAN_ALLOWED_TOOLS.has(toolName)) {
    throw new Error(`Tool ${toolName} is not available in PLAN mode`);
  }

  await enforcePermission(toolName, input, ctx);

  switch (toolName) {
    case "readFile": {
      const { path } = toolInputSchemas.readFile.parse(input);
      const { resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, "utf-8");
      return content.length > MAX_FILE_SIZE
        ? { content: content.slice(0, MAX_FILE_SIZE), truncated: true, totalLength: content.length }
        : { content };
    }
    case "listDirectory": {
      const { path } = toolInputSchemas.listDirectory.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const entries = await readdir(resolved);
      const results: { name: string; type: "file" | "directory" }[] = [];

      for (const entry of entries) {
        if (entry.startsWith(".") || entry === "node_modules") continue;
        const info = await stat(join(resolved, entry));
        results.push({ name: entry, type: info.isDirectory() ? "directory" : "file" });
      }

      results.sort((a, b) =>
        a.type !== b.type ? (a.type === "directory" ? -1 : 1) : a.name.localeCompare(b.name),
      );
      return { path: relative(cwd, resolved) || ".", entries: results };
    }
    case "glob": {
      const { pattern, path } = toolInputSchemas.glob.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const glob = new Bun.Glob(pattern);
      const files: string[] = [];
      let truncated = false;

      for await (const match of glob.scan({ cwd: resolved, dot: false, onlyFiles: true })) {
        if (match.includes("node_modules")) continue;
        if (files.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
        files.push(relative(cwd, resolve(resolved, match)));
      }

      files.sort();
      return { files, ...(truncated ? { truncated: true } : {}) };
    }
    case "grep": {
      const { pattern, path, include } = toolInputSchemas.grep.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const args = [
        "-rn",
        "--color=never",
        "--exclude-dir=node_modules",
        "--exclude-dir=.git",
        "-E",
      ];
      if (include) args.push(`--include=${include}`);
      args.push(pattern, resolved);

      const proc = Bun.spawn(["grep", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;

      if (exitCode !== 0 && exitCode !== 1) throw new Error(`grep failed: ${stderr.trim()}`);
      if (!stdout.trim()) return { matches: [], message: "No matches found" };

      const lines = stdout.trim().split("\n");
      const matches: { file: string; line: number; content: string }[] = [];
      let truncated = false;

      for (const line of lines) {
        if (matches.length >= MAX_MATCHES) {
          truncated = true;
          break;
        }
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          matches.push({
            file: relative(cwd, match[1]!),
            line: Number(match[2]!),
            content: match[3]!,
          });
        }
      }

      return { matches, ...(truncated ? { truncated: true, totalMatches: lines.length } : {}) };
    }
    case "writeFile": {
      const { path, content } = toolInputSchemas.writeFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf-8");
      return {
        success: true as const,
        path: relative(cwd, resolved),
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      };
    }
    case "editFile": {
      const { path, oldString, newString } = toolInputSchemas.editFile.parse(input);
      const { cwd, resolved } = resolveInsideCwd(path);
      const content = await readFile(resolved, "utf-8");
      const occurrences = content.split(oldString).length - 1;

      if (occurrences === 0) throw new Error("oldString not found in file");
      if (occurrences > 1) throw new Error(`oldString is ambiguous; found ${occurrences} matches`);

      await writeFile(resolved, content.replace(oldString, newString), "utf-8");
      return { success: true as const, path: relative(cwd, resolved) };
    }
    case "bash": {
      const { command, timeout = DEFAULT_TIMEOUT } = toolInputSchemas.bash.parse(input);
      const proc = Bun.spawn(["bash", "-c", command], {
        cwd: resolveInsideCwd(".").resolved,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, TERM: "dumb" },
      });
      const timer = setTimeout(() => proc.kill(), timeout);
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);
      return {
        stdout: truncate(stdout, MAX_OUTPUT),
        stderr: truncate(stderr, MAX_OUTPUT),
        exitCode,
      };
    }
    case "loadSkill": {
      const { id } = toolInputSchemas.loadSkill.parse(input);
      const skill = ctx.skills.find((candidate) => candidate.id === id);
      if (!skill) throw new Error(`Unknown skill: ${id}`);

      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        content: skill.content,
        ...(skill.truncated ? { truncated: true } : {}),
      };
    }
    case "question": {
      const parsed = toolInputSchemas.question.parse(input);
      return ctx.askQuestion(parsed);
    }
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
};
