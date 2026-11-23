import type { ReactNode } from "react";

export type DialogConfig = {
  title: string;
  children: ReactNode;
};

export type PromptChoice<T> = {
  label: string;
  value: T;
  description?: string;
};

export type PromptConfig<T> = {
  title: string;
  message?: string;
  choices: PromptChoice<T>[];
  multiple?: boolean;
  placeholder?: string;
};
