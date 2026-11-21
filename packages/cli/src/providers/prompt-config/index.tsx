import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { Mode, type ModeType } from "@nightcode/shared";
import { apiClient } from "../../lib/api-client";
import { getErrorMessage } from "../../lib/http-errors";
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
  const [mode, setMode] = useState<ModeType>(Mode.BUILD);
  const [model, setModel] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadDefaultModel = async () => {
      try {
        const response = await apiClient.models.$get();
        if (!response.ok) throw new Error(await getErrorMessage(response));

        const models = await response.json();
        if (!ignore && models.length > 0) {
          setModel((current) => current || models[0]!.id);
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

  const toggleMode = useCallback(() => {
    setMode((m) => (m === Mode.BUILD ? Mode.PLAN : Mode.BUILD));
  }, []);

  return (
    <PromptConfigContext.Provider 
      value={{ 
        mode, 
        toggleMode, 
        setMode, 
        model, 
        setModel
    }}>
      {children}
    </PromptConfigContext.Provider>
  );
};
