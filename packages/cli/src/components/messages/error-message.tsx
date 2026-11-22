import { memo } from "react";
import { TextAttributes } from "@opentui/core";
import { MessageFrame } from "./message-frame";
import { useTheme } from "../../providers/theme";

type Props = {
  message: string;
};

function ErrorMessageComponent({ message }: Props) {
  const { colors } = useTheme();

  return (
    <MessageFrame
      accentColor={colors.error}
      borderChar="┃"
      bottomChar="╹"
    >
      <text selectable={false} attributes={TextAttributes.DIM} fg={colors.error}>
        {message}
      </text>
    </MessageFrame>
  );
}

export const ErrorMessage = memo(ErrorMessageComponent);
