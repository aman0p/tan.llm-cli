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
  const [error, setError] = useState("");

  const handleSubmit = useCallback(() => {
    try {
      const modelId = addCustomModel(slug);
      onSelectModel(modelId);
      dialog.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid model slug");
    }
  }, [slug, onSelectModel, dialog]);

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
