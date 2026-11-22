import type { ReactNode } from "react";
import { TextAttributes } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { useTheme } from "../../providers/theme";
import { Keycap } from "./keycap";

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
};

export function DialogFrame({ title, children, onClose, width = 60 }: Props) {
  const { colors } = useTheme();
  const dimensions = useTerminalDimensions();

  return (
    <box
      width={Math.min(width, Math.max(20, dimensions.width - 4))}
      height="auto"
      backgroundColor={colors.dialogSurface}
      paddingX={4}
      paddingY={1}
      flexDirection="column"
      gap={1}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <box
        paddingBottom={1}
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
      >
        <text selectable={false} attributes={TextAttributes.BOLD}>{title}</text>
        <box flexDirection="row" gap={1} alignItems="center">
          <Keycap>esc</Keycap>
          <text selectable={false} attributes={TextAttributes.DIM} onMouseDown={onClose}>
            close
          </text>
        </box>
      </box>
      <box flexGrow={1} width="100%">{children}</box>
    </box>
  );
}
