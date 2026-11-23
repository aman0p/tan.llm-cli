import { z } from "zod";
import { tool } from "ai";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const skillSummarySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
});

export type SkillSummary = z.infer<typeof skillSummarySchema>;

export const questionInputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        header: z.string().min(1).max(30).optional(),
        options: z
          .array(
            z.object({
              label: z.string().min(1).max(100),
              description: z.string().max(300).optional(),
            }),
          )
          .min(2)
          .max(5),
        multiple: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(4),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const questionOutputSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      answer: z.union([z.string(), z.array(z.string())]),
      multiple: z.boolean(),
    }),
  ),
});

export type QuestionOutput = z.infer<typeof questionOutputSchema>;

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read"),
  }),
  listDirectory: z.object({
    path: z.string().default(".").describe("Relative directory path to list"),
  }),
  glob: z.object({
    pattern: z.string().describe("Glob pattern to match files"),
    path: z.string().default(".").describe("Directory to search from"),
  }),
  grep: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().default(".").describe("Directory to search from"),
    include: z.string().optional().describe("Optional glob for files to include"),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to write"),
    content: z.string().describe("File contents"),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to edit"),
    oldString: z.string().describe("Exact text to replace; must be unique"),
    newString: z.string().describe("Replacement text"),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to run"),
    description: z.string().optional().describe("Short description of the command"),
    timeout: z.number().optional().describe("Timeout in milliseconds"),
  }),
  loadSkill: z.object({
    id: z.string().describe("ID of the skill to load"),
  }),
  question: questionInputSchema.describe(
    "Ask the user one or more multiple-choice questions and wait for the answers",
  ),
} as const;

export const readOnlyToolContracts = {
  readFile: tool({
    description: "Read a file from the current project directory.",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List entries in a directory under the current project directory.",
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: "Find files matching a glob pattern under the current project directory.",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description:
      "Search file contents with a regular expression under the current project directory.",
    inputSchema: toolInputSchemas.grep,
  }),
  loadSkill: tool({
    description: "Load the full instructions for an available skill by its ID.",
    inputSchema: toolInputSchemas.loadSkill,
  }),
  question: tool({
    description:
      "Ask the user one or more multiple-choice questions and return their answers.",
    inputSchema: toolInputSchemas.question,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Create or overwrite a file under the current project directory.",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: "Replace exact text in a file under the current project directory.",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Run a shell command in the current project directory.",
    inputSchema: toolInputSchemas.bash,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.PLAN 
    ? readOnlyToolContracts 
    : buildToolContracts;
};
