import type { ReactNode } from "react";
import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";

type Props = {
  children: ReactNode;
};

export function Keycap({ children }: Props) {
  const { colors } = useTheme();

  return (
    <box
      height={1}
      paddingX={1}
      flexShrink={0}
      backgroundColor={colors.surface}
    >
      <text selectable={false} attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        {children}
      </text>
    </box>
  );
}
