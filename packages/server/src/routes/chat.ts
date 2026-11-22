import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type InferUITools,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { db } from "@nightcode/database/client";
import type { Prisma } from "@nightcode/database";
import {
  getToolContracts,
  modeSchema,
  type ModeType,
  type ToolContracts
} from "@nightcode/shared";
import { buildSystemPrompt } from "../system-prompt";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { resolveChatModel } from "../lib/models";

type ChatMessageMetadata = {
  mode?: ModeType;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type nightcodeUIMessage = UIMessage<ChatMessageMetadata, never, InferUITools<ToolContracts>>;

const submitSchema = z.object({
  id: z.string(),
  messages: z
    .array(
      z.custom<nightcodeUIMessage>((value) => {
        return value != null && typeof value === "object" && "id" in value && "parts" in value;
      }),
    )
    .min(1),
  mode: modeSchema,
  model: z.string().trim().min(1).max(200).regex(/^[^\s]+$/, "Invalid model id"),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

function hasPendingToolCalls(message: nightcodeUIMessage) {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const state = (part as { state?: string }).state;
      return state !== "output-available" && state !== "output-error";
    }

    return false;
  });
};

function isValidUIMessage(message: nightcodeUIMessage): boolean {
  return (
    message != null &&
    typeof message.id === "string" &&
    message.id.length > 0 &&
    Array.isArray(message.parts) &&
    message.parts.length > 0
  );
};

function getApiKey(requestHeader: string | undefined) {
  const fromHeader = requestHeader?.trim();
  if (fromHeader) return fromHeader;

  const fromEnv = process.env.OPENROUTER_API_KEY?.trim();
  return fromEnv || null;
};

const app = new Hono<AuthenticatedEnv>()
  .post(
    "/",
    submitValidator,
    async (c) => {
      const apiKey = getApiKey(c.req.header("x-openrouter-api-key"));
      if (!apiKey) {
        return c.json({ error: "No OpenRouter API key configured. Run /set-key to add one." }, 400);
      }

      const userId = c.get("userId");
      const { id, messages, mode, model } = c.req.valid("json");

      const session = await db.session.findUnique({
        where: { id, userId },
      });

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      const startTime = Date.now();
      const tools = getToolContracts(mode);
      const resolvedModel = resolveChatModel(model, apiKey);
      const previousMessages = Array.isArray(session.messages)
        ? (session.messages as unknown as nightcodeUIMessage[]).filter(isValidUIMessage)
        : [];
      const mergedMessages = [...previousMessages];
      
      for (const message of messages) {
        const incomingMessage = {
          ...message,
          metadata: { ...message.metadata, mode, model },
        } satisfies nightcodeUIMessage;

        const existingMessageIndex = mergedMessages.findIndex((m) => m.id === incomingMessage.id);

        if (existingMessageIndex === -1) {
          mergedMessages.push(incomingMessage);
        } else {
          mergedMessages[existingMessageIndex] = incomingMessage;
        }
      }

      const nextMessages = await validateUIMessages<nightcodeUIMessage>({
        messages: mergedMessages.filter(isValidUIMessage),
        tools,
      });
      const modelMessages = await convertToModelMessages(nextMessages, { tools });
      let completedUsage: LanguageModelUsage | null = null;

      const result = streamText({
        model: resolvedModel,
        system: buildSystemPrompt({ mode }),
        messages: modelMessages,
        tools,
        onFinish(event) {
          completedUsage = event.totalUsage;
        },
        onError(error) {
          console.error("Chat stream error:", error instanceof Error ? error.message : error);
        },
      });

      return result.toUIMessageStreamResponse<nightcodeUIMessage>({
        originalMessages: nextMessages,
        messageMetadata({ part }) {
          if (part.type === "start") {
            return { mode, model };
          }

          if (part.type !== "finish") return undefined;

          return {
            mode,
            model,
            durationMs: Date.now() - startTime,
            ...(completedUsage ? { usage: completedUsage } : {}),
          };
        },
        async onFinish(event) {
          if (event.isAborted) return;

          if (!isValidUIMessage(event.responseMessage)) return;

          if (hasPendingToolCalls(event.responseMessage)) return;

          await db.session.update({
            where: { id, userId },
            data: {
              messages: event.messages.filter(isValidUIMessage) as unknown as Prisma.InputJsonValue,
            },
          });
        },
        onError(error) {
          return error instanceof Error ? error.message : String(error);
        },
      });
    },
  );

export default app;
