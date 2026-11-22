import { TextAttributes } from "@opentui/core";
import { CodeBlock } from "./code-block";
import { useTheme } from "../providers/theme";

type Block =
  | { kind: "text"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "code"; text: string; language: string }
  | { kind: "blank" };

type Props = {
  text: string;
  streaming?: boolean;
};

function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let inCode = false;
  let language = "";
  let codeLines: string[] = [];

  for (const line of lines) {
    const fence = line.trim();

    if (fence.startsWith("```")) {
      if (inCode) {
        blocks.push({ kind: "code", text: codeLines.join("\n"), language });
        inCode = false;
        codeLines = [];
        language = "";
      } else {
        inCode = true;
        language = fence.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.trim().length === 0) {
      const previous = blocks[blocks.length - 1];
      if (previous?.kind !== "blank") blocks.push({ kind: "blank" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      continue;
    }

    const bullet = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push({ kind: "bullet", text: bullet[1]! });
      continue;
    }

    blocks.push({ kind: "text", text: line });
  }

  if (inCode) {
    blocks.push({ kind: "code", text: codeLines.join("\n"), language });
  }

  return blocks;
}

function InlineText({ text }: { text: string }) {
  const { colors } = useTheme();
  const pieces = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter((piece) => piece.length > 0);

  return (
    <text selectable={false}>
      {pieces.map((piece, index) => {
        if (piece.startsWith("`") && piece.endsWith("`")) {
          return <span key={index} fg={colors.info}>{piece.slice(1, -1)}</span>;
        }

        if (piece.startsWith("**") && piece.endsWith("**")) {
          return (
            <span key={index} attributes={TextAttributes.BOLD}>
              {piece.slice(2, -2)}
            </span>
          );
        }

        return <span key={index}>{piece}</span>;
      })}
    </text>
  );
}

export function MarkdownText({ text, streaming = false }: Props) {
  const { colors } = useTheme();
  const blocks = parseMarkdown(text);

  return (
    <box width="100%" flexDirection="column">
      {blocks.map((block, index) => {
        if (block.kind === "blank") {
          return <box key={index} height={1} />;
        }

        if (block.kind === "code") {
          return <CodeBlock key={index} code={block.text} language={block.language} />;
        }

        if (block.kind === "heading") {
          return (
            <text
              key={index}
              selectable={false}
              attributes={TextAttributes.BOLD}
              fg={block.level === 1 ? colors.primary : colors.info}
            >
              {block.text}
            </text>
          );
        }

        if (block.kind === "bullet") {
          return (
            <box key={index} flexDirection="row" gap={1} paddingX={1} width="100%">
              <text selectable={false} fg={colors.primary}>•</text>
              <box flexGrow={1} flexShrink={1}>
                <InlineText text={block.text} />
              </box>
            </box>
          );
        }

        return <InlineText key={index} text={block.text} />;
      })}
      {streaming ? <text selectable={false} fg={colors.primary}>▌</text> : null}
    </box>
  );
}
