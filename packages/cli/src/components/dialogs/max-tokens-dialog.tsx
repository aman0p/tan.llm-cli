import { useCallback, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { getPreferences, updatePreferences } from "../../lib/preferences";

export function MaxTokensDialogContent() {
  const dialog = useDialog();
  const { colors } = useTheme();
  const [value, setValue] = useState(() =>
    getPreferences().maxTokens == null ? "" : String(getPreferences().maxTokens),
  );
  const [error, setError] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      updatePreferences({ maxTokens: undefined });
      dialog.close();
      return;
    }

    const maxTokens = Number(trimmed);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 200_000) {
      setError("Enter a whole number between 1 and 200000");
      return;
    }

    updatePreferences({ maxTokens });
    dialog.close();
  }, [value, dialog]);

  return (
    <box flexDirection="column" gap={1}>
      <text selectable={false}>Max output tokens per reply:</text>
      <box height={1}>
        <input
          focused
          placeholder="8192"
          onInput={(next) => {
            setValue(next);
            setError("");
          }}
          onSubmit={handleSubmit}
        />
      </box>
      {error ? (
        <text selectable={false} fg={colors.error}>{error}</text>
      ) : (
        <text selectable={false} attributes={TextAttributes.DIM}>
          Leave empty to clear the limit. Lower values help when credits are low.
        </text>
      )}
    </box>
  );
}
