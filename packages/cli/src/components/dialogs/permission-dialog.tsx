import type { DialogContextValue } from "../../providers/dialog";
import type { PermissionRequest } from "../../lib/permissions";

export type PermissionChoice = "once" | "always" | "reject";

export async function askPermission(
  dialog: DialogContextValue,
  request: PermissionRequest,
): Promise<PermissionChoice> {
  const source = request.rule
    ? `matched rule: ${request.rule.effect} ${request.rule.action} ${request.rule.resource}`
    : "no matching rule";

  const choice = await dialog.prompt<PermissionChoice>({
    title: "Allow tool call?",
    message: `${request.action} → ${request.resource}\n${source}`,
    choices: [
      { label: "Allow once", value: "once", description: "Approve this call only" },
      { label: "Allow always", value: "always", description: "Save an allow rule in this project" },
      { label: "Reject", value: "reject", description: "Block this call" },
    ],
  });

  return choice ?? "reject";
}
