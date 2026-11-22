import {
  AgentsDialogContent,
  ApiKeyDialogContent,
  CustomModelDialogContent,
  DoctorDialogContent,
  MaxTokensDialogContent,
  ModelsDialogContent,
  SessionsDialogContent,
  ThemeDialogContent,
} from "../dialogs";
import type { Command } from "./types";

import { performLogin } from "../../lib/oauth";
import { clearAuth } from "../../lib/auth";
import { apiClient } from "../../lib/api-client";
import { getCustomModels } from "../../lib/custom-models";
import { getErrorMessage } from "../../lib/http-errors";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    },
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Agent",
        children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />,
      })
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: async (ctx) => {
      ctx.toast.show({ message: "Loading models..." });

      try {
        const response = await apiClient.models.$get();
        if (!response.ok) throw new Error(await getErrorMessage(response));

        const models = await response.json();
        const customModels = getCustomModels();
        const allModels = [
          ...customModels,
          ...models.filter(
            (model: { id: string }) =>
              !customModels.some((custom) => custom.id.toLowerCase() === model.id.toLowerCase()),
          ),
        ];

        ctx.dialog.open({
          title: "Select Model",
          children: (
            <ModelsDialogContent
              models={allModels}
              onSelectModel={ctx.setModel}
            />
          ),
        });
      } catch (error) {
        ctx.toast.show({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to load models",
        });
      }
    },
  },
  {
    name: "preview",
    description: "Preview the transcript layout without API calls",
    value: "/preview",
    action: (ctx) => {
      ctx.navigate("/preview");
    },
  },
  {
    name: "preview-long",
    description: "Preview with a long transcript for performance",
    value: "/preview-long",
    action: (ctx) => {
      ctx.navigate("/preview-long");
    },
  },
  {
    name: "model",
    description: "Add or select a model by OpenRouter slug",
    value: "/model",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Add Model by Slug",
        children: (
          <CustomModelDialogContent onSelectModel={ctx.setModel} />
        ),
      });
    },
  },
  {
    name: "doctor",
    description: "Check server, auth, model and credit health",
    value: "/doctor",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Doctor",
        children: <DoctorDialogContent />,
      });
    },
  },
  {
    name: "max-tokens",
    description: "Set the default max output tokens per reply",
    value: "/max-tokens",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Max Output Tokens",
        children: <MaxTokensDialogContent />,
      });
    },
  },
  {
    name: "set-key",
    description: "Set or update your OpenRouter API key",
    value: "/set-key",
    action: (ctx) => {
      ctx.dialog.open({
        title: "OpenRouter API Key",
        children: <ApiKeyDialogContent />,
      });
    },
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Sessions",
        children: <SessionsDialogContent />,
      })
    },
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialogContent />,
      })
    },
  },
  {
    name: "login",
    description: "Sign in with your browser",
    value: "/login",
    action: async (ctx) => {
      ctx.toast.show({ message: "Opening browser to sign in..." });

      try {
        await performLogin();
        ctx.toast.show({ variant: "success", message: "Signed in" });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Sign in failed or timed out";

        ctx.toast.show({ variant: "error", message });
      }
    },
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
    action: (ctx) => {
      clearAuth();
      ctx.toast.show({ variant: "success", message: "Signed out" });
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];
