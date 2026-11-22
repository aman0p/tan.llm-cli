import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { TextAttributes } from "@opentui/core";
import { EmptyBorder } from "./border";
import { useTheme } from "../providers/theme";

type Props = {
  code: string;
  language?: string;
};

const HIGHLIGHT_TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/[^\n]*|#[^\n]*|\b(?:const|let|var|function|return|if|else|for|while|import|from|export|class|new|await|async|type|interface|def|pub|fn|use|package|func)\b)/g;

function copyToClipboard(text: string) {
  const encoded = Buffer.from(text, "utf8").toString("base64");
  process.stdout.write(`\u001b]52;c;${encoded}\u0007`);
}

function highlightLine(line: string, colors: ReturnType<typeof useTheme>["colors"]): ReactNode {
  const pieces = line.split(HIGHLIGHT_TOKEN).filter((piece) => piece.length > 0);

  return pieces.map((piece, index) => {
    if (/^["'`]/.test(piece)) {
      return <span key={index} fg={colors.success}>{piece}</span>;
    }

    if (piece.startsWith("//") || piece.startsWith("#")) {
      return <span key={index} fg={colors.dimSeparator}>{piece}</span>;
    }

    if (/^[A-Za-z]+$/.test(piece)) {
      return <span key={index} fg={colors.primary}>{piece}</span>;
    }

    return <span key={index}>{piece}</span>;
  });
}

export function CodeBlock({ code, language }: Props) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <box
      width="100%"
      border={["left"]}
      borderColor={colors.thinkingBorder}
      customBorderChars={{ ...EmptyBorder, vertical: "│" }}
      paddingX={2}
      paddingY={1}
      backgroundColor={colors.surface}
    >
      <box flexDirection="row" justifyContent="space-between" width="100%" paddingBottom={1}>
        <text selectable={false} attributes={TextAttributes.BOLD} fg={colors.dimSeparator}>
          {language || "code"}
        </text>
        <text
          selectable={false}
          fg={copied ? colors.success : colors.dimSeparator}
          onMouseDown={handleCopy}
        >
          {copied ? "copied" : "copy"}
        </text>
      </box>
      {code.split("\n").map((line, index) => (
        <text key={index} selectable={false}>
          {highlightLine(line, colors)}
        </text>
      ))}
    </box>
  );
}
