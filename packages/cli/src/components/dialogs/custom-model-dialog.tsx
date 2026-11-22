import { useCallback, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { addCustomModel } from "../../lib/custom-models";

type CustomModelDialogContentProps = {
  onSelectModel: (modelId: string) => void;
};

export function CustomModelDialogContent({ onSelectModel }: CustomModelDialogContentProps) {
  const dialog = useDialog();
  const { colors } = useTheme();
  const [slug, setSlug] = useState("");
  const [maxTokensText, setMaxTokensText] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = maxTokensText.trim();
    const maxTokens = trimmed.length > 0 ? Number(trimmed) : undefined;

    if (maxTokens !== undefined && !Number.isFinite(maxTokens)) {
      setError("Max tokens must be a number");
      return;
    }

    try {
      const modelId = addCustomModel(slug, maxTokens);
      onSelectModel(modelId);
      dialog.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid model slug");
    }
  }, [slug, maxTokensText, onSelectModel, dialog]);

  return (
    <box flexDirection="column" gap={1}>
      <text selectable={false}>OpenRouter model slug:</text>
      <box height={1}>
        <input
          focused
          placeholder="thinkingmachines/inkling-2-mini"
          onInput={(value) => {
            setSlug(value);
            setError("");
          }}
          onSubmit={handleSubmit}
        />
      </box>
      <text selectable={false} attributes={TextAttributes.DIM}>
        Max tokens (optional):
      </text>
      <box height={1}>
        <input
          placeholder="8192"
          onInput={(value) => {
            setMaxTokensText(value);
            setError("");
          }}
          onSubmit={handleSubmit}
        />
      </box>
      {error ? (
        <text selectable={false} fg={colors.error}>{error}</text>
      ) : (
        <text selectable={false} attributes={TextAttributes.DIM}>
          Saved locally and available in /models.
        </text>
      )}
    </box>
  );
}
