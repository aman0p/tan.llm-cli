import { memo } from "react";
import prettyMs from "pretty-ms";
import { TextAttributes } from "@opentui/core";
import { Mode, type ModeType } from "@tan.llm/shared";
import { MessageFrame } from "./message-frame";
import { MarkdownText } from "../markdown-text";
import { useTheme } from "../../providers/theme";
import type { Message } from "../../hooks/use-chat";

type ClientMessagePart = Message["parts"][number];
type ToolPart = Extract<ClientMessagePart, { type: `tool-${string}` | "dynamic-tool" }>;

type Props = {
  parts: ClientMessagePart[];
  model: string;
  mode: ModeType;
  durationMs?: number;
  streaming?: boolean;
};

type Segment =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "tool"; part: ToolPart };

function formatToolName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
};

function isToolPart(part: ClientMessagePart): part is ToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
};

function formatToolArgs(part: ToolPart): string {
  if (!("input" in part) || part.input == null) return "";
  if (typeof part.input !== "object") return String(part.input);
  return Object.values(part.input).map(String).join(" ");
}

function buildSegments(parts: ClientMessagePart[]): Segment[] {
  const segments: Segment[] = [];

  for (const part of parts) {
    if (part.type === "text") {
      const previous = segments[segments.length - 1];
      if (previous?.kind === "text") {
        previous.text += part.text;
      } else {
        segments.push({ kind: "text", text: part.text });
      }
      continue;
    }

    if (part.type === "reasoning") {
      segments.push({ kind: "reasoning", text: part.text });
      continue;
    }

    if (isToolPart(part)) {
      segments.push({ kind: "tool", part });
    }
  }

  return segments;
}

function compact(text: string, limit = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function BotMessageComponent({
  parts,
  model,
  mode,
  durationMs,
  streaming = false,
}: Props) {
  const { colors } = useTheme();
  const segments = buildSegments(parts);
  const hasText = segments.some((segment) => segment.kind === "text");

  return (
    <MessageFrame accentColor={colors.thinkingBorder} borderChar="│">
      <box width="100%" flexDirection="column" gap={1}>
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return <MarkdownText key={`text-${index}`} text={segment.text} streaming={streaming} />;
          }

          if (segment.kind === "reasoning") {
            return (
              <text key={`reasoning-${index}`} selectable={false} attributes={TextAttributes.DIM}>
                <em fg={colors.thinking}>Thinking:</em> {compact(segment.text)}
              </text>
            );
          }

          const part = segment.part;
          const toolName =
            part.type === "dynamic-tool" ? part.toolName : part.type.slice("tool-".length);
          const pending = part.state !== "output-available" && part.state !== "output-error";

          return (
            <text key={`tool-${part.toolCallId}-${index}`} selectable={false} attributes={TextAttributes.DIM}>
              <em fg={colors.info}>{formatToolName(toolName)}:</em> {compact(formatToolArgs(part))}
              {pending ? " …" : ""}
              {part.state === "output-error" ? ` ${part.errorText ?? "failed"}` : ""}
            </text>
          );
        })}

        {segments.length === 0 && streaming ? (
          <text selectable={false} fg={colors.primary}>▌</text>
        ) : null}

        <box flexDirection="row" gap={1} paddingTop={1}>
          <text selectable={false} fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>
            ◉
          </text>
          <text selectable={false}>{mode === Mode.PLAN ? "Plan" : "Build"}</text>
          <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
          <text selectable={false} attributes={TextAttributes.DIM}>{model}</text>
          {durationMs != null ? (
            <>
              <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
              <text selectable={false} attributes={TextAttributes.DIM}>{prettyMs(durationMs)}</text>
            </>
          ) : null}
          {streaming ? (
            <>
              <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
              <text selectable={false} fg={colors.primary}>streaming…</text>
            </>
          ) : null}
          {!streaming && !hasText && segments.length === 0 ? (
            <text selectable={false} attributes={TextAttributes.DIM}>no output</text>
          ) : null}
        </box>
      </box>
    </MessageFrame>
  );
}

export const BotMessage = memo(BotMessageComponent);
