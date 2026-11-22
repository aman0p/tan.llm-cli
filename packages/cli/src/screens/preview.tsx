import { Mode } from "@tan.llm/shared";
import { SessionShell } from "../components/session-shell";
import { BotMessage, ErrorMessage, UserMessage } from "../components/messages";
import type { Message } from "../hooks/use-chat";

const SAMPLE_MARKDOWN = `# Refactor complete

I updated the model picker and removed the duplicate spacing.

- **Before:** three different padding sources
- **After:** one shared \`MessageFrame\`

\`\`\`ts
export function example(): string {
  // This is a sample code block
  return "fantastic";
}
\`\`\`

Run \`/models\` to try it.`;

const SAMPLE_PARTS = [
  {
    type: "reasoning",
    text: "The user wants a cleaner transcript. I should group reasoning and tool calls, then render the answer with a single metadata line.",
  },
  {
    type: "dynamic-tool",
    toolName: "readFile",
    toolCallId: "preview-read",
    state: "output-available",
    input: { path: "packages/cli/src/components/input-bar.tsx" },
    output: "// ...",
  },
  {
    type: "dynamic-tool",
    toolName: "bash",
    toolCallId: "preview-bash",
    state: "output-error",
    input: { command: "bun test" },
    errorText: "exit code 1",
  },
  {
    type: "text",
    text: SAMPLE_MARKDOWN,
  },
] as unknown as Message["parts"];

export function Preview() {
  return (
    <SessionShell onSubmit={() => {}} inputDisabled>
      <UserMessage message="Clean up the transcript layout" mode={Mode.BUILD} />
      <BotMessage
        parts={SAMPLE_PARTS}
        model="thinkingmachines/inkling-2-mini"
        mode={Mode.BUILD}
        durationMs={1240}
      />
      <ErrorMessage message="OpenRouter rejected the request: insufficient credits (402)." />
      <BotMessage
        parts={[]}
        model="baidu/ernie-5.5-flash-preview:free"
        mode={Mode.PLAN}
        streaming
      />
    </SessionShell>
  );
}

export function PreviewLong() {
  return (
    <SessionShell onSubmit={() => {}} inputDisabled>
      {Array.from({ length: 200 }, (_, index) => (
        <UserMessage
          key={index}
          message={`Preview message ${index + 1} — checking scrollback performance`}
          mode={index % 2 === 0 ? Mode.BUILD : Mode.PLAN}
        />
      ))}
    </SessionShell>
  );
}
