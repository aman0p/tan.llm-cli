import { useEffect, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { runDoctor, type DoctorResult } from "../../lib/doctor";
import { useTheme } from "../../providers/theme";

const STATUS_ICON: Record<DoctorResult["status"], string> = {
  ok: "✓",
  warn: "!",
  error: "✗",
  info: "·",
};

export function DoctorDialogContent() {
  const { colors } = useTheme();
  const [results, setResults] = useState<DoctorResult[] | null>(null);

  useEffect(() => {
    let ignore = false;

    void runDoctor().then((next) => {
      if (!ignore) setResults(next);
    });

    return () => {
      ignore = true;
    };
  }, []);

  if (!results) {
    return <text selectable={false} attributes={TextAttributes.DIM}>Checking...</text>;
  }

  return (
    <box flexDirection="column" gap={1} width="100%">
      {results.map((result, index) => {
        const color =
          result.status === "ok"
            ? colors.success
            : result.status === "warn"
              ? colors.planMode
              : result.status === "error"
                ? colors.error
                : colors.dimSeparator;

        return (
          <box key={`${result.label}-${index}`} flexDirection="column" gap={0} width="100%">
            <box flexDirection="row" gap={1} width="100%">
              <text selectable={false} fg={color}>{STATUS_ICON[result.status]}</text>
              <text selectable={false} attributes={TextAttributes.BOLD}>{result.label}</text>
              <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>›</text>
              <box flexGrow={1} flexShrink={1}>
                <text selectable={false} attributes={TextAttributes.DIM}>{result.detail}</text>
              </box>
            </box>
            {result.hint ? (
              <box paddingLeft={3}>
                <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                  {result.hint}
                </text>
              </box>
            ) : null}
          </box>
        );
      })}
    </box>
  );
}
