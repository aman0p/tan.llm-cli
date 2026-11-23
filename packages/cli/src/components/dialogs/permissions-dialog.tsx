import { TextAttributes } from "@opentui/core";
import { DialogSearchList } from "../dialog-search-list";
import { loadPermissions } from "../../lib/permissions";

type RuleItem = {
  key: string;
  action: string;
  resource: string;
  effect: string;
};

export function PermissionsDialogContent() {
  const config = loadPermissions();
  const rules: RuleItem[] = config.rules.map((rule, index) => ({
    key: `${index}-${rule.action}-${rule.resource}`,
    action: rule.action,
    resource: rule.resource,
    effect: rule.effect,
  }));

  return (
    <box flexDirection="column" gap={1}>
      <text selectable={false} attributes={TextAttributes.DIM}>
        {config.paths.length > 0
          ? `Config: ${config.paths.join(", ")}`
          : "Config: none (defaults only)"}
      </text>
      <text selectable={false} attributes={TextAttributes.DIM}>
        Last matching rule wins. PLAN mode restrictions cannot be overridden.
      </text>
      <DialogSearchList
        items={rules}
        onSelect={() => {}}
        filterFn={(rule, query) =>
          `${rule.action} ${rule.resource} ${rule.effect}`.toLowerCase().includes(query.toLowerCase())
        }
        renderItem={(rule, isSelected) => (
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {rule.effect.toUpperCase().padEnd(4)} {rule.action} {rule.resource}
          </text>
        )}
        getKey={(rule) => rule.key}
        placeholder="Search rules"
        emptyText="No rules"
      />
    </box>
  );
}
