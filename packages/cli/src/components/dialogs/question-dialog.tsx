import type { QuestionInput, QuestionOutput } from "@tan.llm/shared";
import type { DialogContextValue } from "../../providers/dialog";

export async function askQuestions(
  dialog: DialogContextValue,
  input: QuestionInput,
): Promise<QuestionOutput> {
  const answers: QuestionOutput["answers"] = [];

  for (const question of input.questions) {
    const choices = question.options.map((option) => ({
      label: option.label,
      value: option.label,
      description: option.description,
    }));

    if (question.multiple) {
      const selected = await dialog.prompt<string>({
        title: question.header ?? "Question",
        message: question.question,
        choices,
        multiple: true,
        placeholder: "Filter options",
      });

      if (selected === null) throw new Error("Question cancelled");
      answers.push({ question: question.question, answer: selected, multiple: true });
      continue;
    }

    const selected = await dialog.prompt<string>({
      title: question.header ?? "Question",
      message: question.question,
      choices,
      placeholder: "Filter options",
    });

    if (selected === null) throw new Error("Question cancelled");
    answers.push({ question: question.question, answer: selected, multiple: false });
  }

  return { answers };
}
