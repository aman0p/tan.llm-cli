import { useState, useCallback } from "react";
import { TextAttributes } from "@opentui/core";
import { useDialog } from "../../providers/dialog";
import { saveOpenRouterApiKey } from "../../lib/auth";

export function ApiKeyDialogContent() {
  const dialog = useDialog();
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = useCallback((value: string) => {
    saveOpenRouterApiKey(value);
    dialog.close();
  }, [dialog]);

  return (
    <box flexDirection="column" gap={1}>
      <text selectable={false}>Paste your OpenRouter API key:</text>
      <box height={1}>
        <input
          focused
          placeholder="sk-or-v1-..."
          onInput={setApiKey}
          onSubmit={() => handleSubmit(apiKey)}
        />
      </box>
      <text selectable={false} attributes={TextAttributes.DIM}>
        Stored locally with owner-only permissions. Leave empty to clear.
      </text>
    </box>
  );
}
