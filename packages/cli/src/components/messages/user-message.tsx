import { memo } from "react";
import { Mode, type ModeType } from "@tan.llm/shared";
import { MessageFrame } from "./message-frame";
import { useTheme } from "../../providers/theme";

type Props = {
  message: string;
  mode: ModeType;
};

function UserMessageComponent({ message, mode }: Props) {
  const { colors } = useTheme();

  return (
    <MessageFrame
      accentColor={mode === Mode.PLAN ? colors.planMode : colors.primary}
      borderChar="┃"
      bottomChar="╹"
    >
      <text selectable={false}>{message}</text>
    </MessageFrame>
  );
}

export const UserMessage = memo(UserMessageComponent);
