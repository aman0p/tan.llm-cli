import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Mode, type ModeType } from "@tan.llm/shared";
import { apiClient } from "../../lib/api-client";
import { getErrorMessage } from "../../lib/http-errors";
import { getPreferences, updatePreferences } from "../../lib/preferences";
import { useToast } from "../toast";

type PromptConfigContextValue = {
  mode: ModeType;
  toggleMode: () => void;
  setMode: (mode: ModeType) => void;
  model: string;
  setModel: (model: string) => void;
};

const PromptConfigContext = createContext<PromptConfigContextValue | null>(null);

export function usePromptConfig(): PromptConfigContextValue {
  const value = useContext(PromptConfigContext);
  if (!value) {
    throw new Error("usePromptConfig must be used within a PromptConfigProvider");
  }
  return value;
};

type PromptConfigProviderProps = {
  children: ReactNode;
};

export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const toast = useToast();
  const [mode, setModeState] = useState<ModeType>(() => getPreferences().mode ?? Mode.BUILD);
  const [model, setModelState] = useState(() => getPreferences().model ?? "");

  useEffect(() => {
    let ignore = false;

    const loadDefaultModel = async () => {
      try {
        const response = await apiClient.models.$get();
        if (!response.ok) throw new Error(await getErrorMessage(response));

        const models = await response.json();
        if (!ignore && models.length > 0) {
          setModelState((current) => current || models[0]!.id);
        }
      } catch (error) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to load models",
        });
      }
    };

    void loadDefaultModel();
    return () => {
      ignore = true;
    };
  }, [toast]);

  useEffect(() => {
    try {
      updatePreferences({ mode });
    } catch {
      // Settings are best-effort.
    }
  }, [mode]);

  useEffect(() => {
    if (!model) return;
    try {
      updatePreferences({ model });
    } catch {
      // Settings are best-effort.
    }
  }, [model]);

  const setMode = useCallback((next: ModeType) => {
    setModeState(next);
  }, []);

  const setModel = useCallback((next: string) => {
    setModelState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === Mode.BUILD ? Mode.PLAN : Mode.BUILD));
  }, []);

  return (
    <PromptConfigContext.Provider
      value={{
        mode,
        toggleMode,
        setMode,
        model,
        setModel,
      }}>
      {children}
    </PromptConfigContext.Provider>
  );
};
