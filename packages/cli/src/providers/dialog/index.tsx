import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RGBA, TextAttributes } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import type { DialogConfig, PromptChoice, PromptConfig } from "./types";
import { useKeyboardLayer } from "../keyboard-layer";
import { useTheme } from "../theme";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { DialogSearchList } from "../../components/dialog-search-list";

export type DialogContextValue = {
  open: (config: DialogConfig) => void;
  close: () => void;
  prompt: {
    <T>(config: PromptConfig<T> & { multiple: true }): Promise<T[] | null>;
    <T>(config: PromptConfig<T> & { multiple?: false }): Promise<T | null>;
  };
};

type PromptEntry = {
  id: number;
  config: PromptConfig<unknown>;
  resolve: (value: unknown | null) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return value;
};

type DialogProviderProps = {
  children: ReactNode;
};

export function DialogProvider({ children }: DialogProviderProps) {
  const [currentDialog, setCurrentDialog] = useState<DialogConfig | null>(null);
  const [activePrompt, setActivePrompt] = useState<PromptEntry | null>(null);
  const activePromptRef = useRef<PromptEntry | null>(null);
  const promptQueueRef = useRef<PromptEntry[]>([]);
  const nextPromptIdRef = useRef(0);
  const { push, pop } = useKeyboardLayer();

  const close = useCallback(() => {
    setCurrentDialog(null);
    pop("dialog");
  }, [pop]);

  const open = useCallback(
    (config: DialogConfig) => {
      setCurrentDialog(config);
      push("dialog", () => {
        close();
        return true;
      });
    },
    [push, close],
  );

  const startNextPrompt = useCallback(() => {
    const next = promptQueueRef.current.shift() ?? null;
    activePromptRef.current = next;
    setActivePrompt(next);

    if (next) {
      push("dialog");
    } else {
      pop("dialog");
    }
  }, [push, pop]);

  const resolvePrompt = useCallback(
    (value: unknown | null) => {
      const active = activePromptRef.current;
      if (!active) return;
      activePromptRef.current = null;
      active.resolve(value);
      startNextPrompt();
    },
    [startNextPrompt],
  );

  const prompt = useCallback(
    function <T>(config: PromptConfig<T>): Promise<unknown> {
      return new Promise((resolve) => {
        const entry: PromptEntry = {
          id: ++nextPromptIdRef.current,
          config: config as PromptConfig<unknown>,
          resolve: resolve as (value: unknown | null) => void,
        };

        promptQueueRef.current.push(entry);

        if (!activePromptRef.current) {
          close();
          startNextPrompt();
        }
      });
    },
    [close, startNextPrompt],
  ) as DialogContextValue["prompt"];

  const value: DialogContextValue = {
    open,
    close,
    prompt,
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Dialog currentDialog={currentDialog} close={close} />
      <PromptOverlay entry={activePrompt} resolve={resolvePrompt} />
    </DialogContext.Provider>
  );
};

type DialogProps = {
  currentDialog: DialogConfig | null;
  close: () => void;
};

function Dialog({ currentDialog, close }: DialogProps) {
  const { isTopLayer } = useKeyboardLayer();
  const dimensions = useTerminalDimensions();

  useKeyboard((key) => {
    if (!currentDialog || !isTopLayer("dialog")) return;

    if (key.name === "escape") {
      close();
    }
  });

  if (!currentDialog) {
    return null;
  }

  const { title, children } = currentDialog;

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={dimensions.width}
      height={dimensions.height}
      justifyContent="center"
      alignItems="center"
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
      zIndex={100}
      onMouseDown={() => close()}
    >
      <DialogFrame title={title} onClose={close}>
        {children}
      </DialogFrame>
    </box>
  );
}

type MultiChoiceListProps<T> = {
  choices: PromptChoice<T>[];
  onConfirm: (values: T[]) => void;
  onCancel: () => void;
};

function MultiChoiceList<T>({ choices, onConfirm, onCancel }: MultiChoiceListProps<T>) {
  const [selected, setSelected] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const { isTopLayer } = useKeyboardLayer();
  const { colors } = useTheme();

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "escape") {
      key.preventDefault();
      onCancel();
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault();
      onConfirm(selected.map((i) => choices[i]!.value));
    } else if (key.name === "space") {
      key.preventDefault();
      setSelected((current) =>
        current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
      );
    } else if (key.name === "up") {
      key.preventDefault();
      setIndex((current) => Math.max(0, current - 1));
    } else if (key.name === "down") {
      key.preventDefault();
      setIndex((current) => Math.min(choices.length - 1, current + 1));
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      {choices.map((choice, i) => {
        const isHighlighted = i === index;
        const isSelected = selected.includes(i);
        return (
          <box
            key={`${choice.label}-${i}`}
            flexDirection="row"
            height={1}
            overflow="hidden"
            backgroundColor={isHighlighted ? colors.selection : undefined}
          >
            <text selectable={false} fg={isHighlighted ? "black" : "white"}>
              {isSelected ? " [x] " : " [ ] "}
              {choice.label}
              {choice.description ? ` — ${choice.description}` : ""}
            </text>
          </box>
        );
      })}
      <text selectable={false} attributes={TextAttributes.DIM}>
        space to toggle · enter to confirm · esc to cancel
      </text>
    </box>
  );
}

type PromptOverlayProps = {
  entry: PromptEntry | null;
  resolve: (value: unknown | null) => void;
};

function PromptOverlay({ entry, resolve }: PromptOverlayProps) {
  const dimensions = useTerminalDimensions();
  const { isTopLayer } = useKeyboardLayer();

  useKeyboard((key) => {
    if (!entry || !isTopLayer("dialog")) return;
    if (key.name === "escape") {
      key.preventDefault();
      resolve(null);
    }
  });

  if (!entry) {
    return null;
  }

  const config = entry.config;
  const choices = config.choices ?? [];

  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width={dimensions.width}
      height={dimensions.height}
      justifyContent="center"
      alignItems="center"
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
      zIndex={200}
      onMouseDown={() => resolve(null)}
    >
      <DialogFrame title={config.title} onClose={() => resolve(null)}>
        <box flexDirection="column" gap={1}>
          {config.message ? (
            <text selectable={false} attributes={TextAttributes.DIM}>
              {config.message}
            </text>
          ) : null}
          {config.multiple ? (
            <MultiChoiceList
              choices={choices}
              onConfirm={(values) => resolve(values)}
              onCancel={() => resolve(null)}
            />
          ) : (
            <DialogSearchList
              items={choices}
              getKey={(choice) => `${choice.label}-${choice.value}`}
              filterFn={(choice, query) =>
                choice.label.toLowerCase().includes(query.toLowerCase()) ||
                (choice.description ?? "").toLowerCase().includes(query.toLowerCase())
              }
              renderItem={(choice, isSelected) => (
                <text selectable={false} fg={isSelected ? "black" : "white"}>
                  {isSelected ? " • " : "   "}
                  {choice.label}
                  {choice.description ? ` — ${choice.description}` : ""}
                </text>
              )}
              onSelect={(choice) => resolve(choice.value)}
              placeholder={config.placeholder ?? "Choose"}
              emptyText="No choices"
            />
          )}
        </box>
      </DialogFrame>
    </box>
  );
}
