import type { ReactNode } from "react";
import { EmptyBorder } from "../border";
import { useTheme } from "../../providers/theme";

type Props = {
  accentColor: string;
  borderChar?: string;
  bottomChar?: string;
  children: ReactNode;
  paddingX?: number;
  paddingY?: number;
  background?: boolean;
};

export function MessageFrame({
  accentColor,
  borderChar = "│",
  bottomChar = "",
  children,
  paddingX = 2,
  paddingY = 1,
  background = true,
}: Props) {
  const { colors } = useTheme();

  return (
    <box width="100%" flexShrink={0}>
      <box
        border={["left"]}
        borderColor={accentColor}
        customBorderChars={{
          ...EmptyBorder,
          vertical: borderChar,
          bottomLeft: bottomChar,
        }}
        width="100%"
      >
        <box
          width="100%"
          paddingX={paddingX}
          paddingY={paddingY}
          backgroundColor={background ? colors.surface : undefined}
        >
          {children}
        </box>
      </box>
    </box>
  );
}
