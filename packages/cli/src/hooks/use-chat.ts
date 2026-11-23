import { useMemo } from "react";
import { useChat as useAiChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type InferUITools,
  lastAssistantMessageIsCompleteWithToolCalls,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import {
  type ModeType,
  type SkillSummary,
  type ToolContracts,
} from "@tan.llm/shared";
import { apiClient } from "../lib/api-client";
import { getOpenRouterApiKey } from "../lib/auth";
import { getMaxTokensForModel } from "../lib/custom-models";
import { executeLocalTool, type ToolExecutionContext } from "../lib/local-tools";
import { loadPermissions, resolvePermission } from "../lib/permissions";
import { getPreferences } from "../lib/preferences";
import { discoverSkills, getSkillSummaries } from "../lib/skills";
import { getValidAccessToken } from "../lib/tokens";
import { askPermission, askQuestions } from "../components/dialogs";
import { useDialog } from "../providers/dialog";
import { useToast } from "../providers/toast";

export type ChatMessageMetadata = {
  mode?: ModeType;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type ChatTools = {
  [Name in keyof InferUITools<ToolContracts>]: {
    input: InferUITools<ToolContracts>[Name]["input"];
    output: unknown;
  };
};

export type Message = UIMessage<ChatMessageMetadata, never, ChatTools>;

function getAdvertisedSkills(): SkillSummary[] {
  const enabledIds = getPreferences().enabledSkillIds;
  const permissions = loadPermissions();

  return getSkillSummaries(
    discoverSkills().filter((skill) => {
      if (skill.hidden) return false;
      if (enabledIds && !enabledIds.includes(skill.id)) return false;
      return resolvePermission(permissions, "skill", skill.id).effect !== "deny";
    }),
  );
}

function applySkillMentions(text: string): string {
  const knownIds = new Set(discoverSkills().map((skill) => skill.id));
  const mentions = new Set<string>();

  const cleaned = text
    .replace(/@([a-z0-9]+(?:-[a-z0-9]+)*)\b/g, (match, id: string) => {
      if (!knownIds.has(id)) return match;
      mentions.add(id);
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();

  if (mentions.size === 0) return cleaned;

  return [
    cleaned,
    "",
    `[Requested skills: ${Array.from(mentions).join(", ")}]`,
    "Load these skills before proceeding.",
  ]
    .join("\n")
    .trim();
}

export function useChat(sessionId: string, initialMessages: Message[]) {
  const dialog = useDialog();
  const toast = useToast();

  const transport = useMemo(() => {
    return new DefaultChatTransport<Message>({
      api: apiClient.chat.$url().toString(),
      async headers() {
        const headers = new Headers();
        const token = await getValidAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const apiKey = getOpenRouterApiKey();
        if (apiKey) headers.set("x-openrouter-api-key", apiKey);

        return headers;
      },
      prepareSendMessagesRequest({ messages }) {
        const message = messages[messages.length - 1];
        if (!message) throw new Error("No message to send");

        const metadata = messages.findLast(
          (m) => m.metadata?.mode && m.metadata?.model,
        )?.metadata;
        const previousMessage = messages[messages.length - 2];
        const requestMessages =
          message.role === "assistant" && previousMessage?.role === "user"
            ? [previousMessage, message]
            : [message];

        const selectedModel = message.metadata?.model ?? metadata?.model ?? "";
        const maxTokens = getMaxTokensForModel(selectedModel) ?? getPreferences().maxTokens;

        return {
          body: {
            id: sessionId,
            messages: requestMessages,
            mode: message.metadata?.mode ?? metadata?.mode,
            model: selectedModel,
            ...(maxTokens == null ? {} : { maxTokens }),
            skills: getAdvertisedSkills(),
          },
        }
      }
    });
  }, [sessionId]);

  const chat = useAiChat<Message>({
    id: sessionId,
    messages: initialMessages,
    transport,
    onToolCall({ toolCall }) {
      const mode = chat.messages.at(-1)?.metadata?.mode ?? "BUILD";
      const context: ToolExecutionContext = {
        mode,
        skills: discoverSkills(),
        permissions: loadPermissions(),
        askPermission: (request) => askPermission(dialog, request),
        askQuestion: (input) => askQuestions(dialog, input),
        onAllowAlways: () => {
          toast.show({ variant: "success", message: "Permission rule saved" });
        },
      };

      void executeLocalTool(toolCall.toolName, toolCall.input, context)
        .then((output) =>
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            output,
          }),
        )
        .catch((error) =>
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: error instanceof Error ? error.message : String(error),
          }),
        );
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    submit: (params: { userText: string; mode: ModeType; model: string }) => {
      return chat.sendMessage({
        text: applySkillMentions(params.userText),
        metadata: {
          mode: params.mode,
          model: params.model,
        },
      })
    },
    abort: chat.stop,
    interrupt: chat.stop,
  };
};
