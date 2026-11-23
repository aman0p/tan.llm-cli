import { useState } from "react";
import { DialogSearchList } from "../dialog-search-list";
import { clearSkillCache, discoverSkills } from "../../lib/skills";
import { getPreferences, updatePreferences } from "../../lib/preferences";

export function SkillsDialogContent() {
  const [skills] = useState(() => {
    clearSkillCache();
    return discoverSkills();
  });
  const [enabled, setEnabled] = useState<string[]>(() => {
    const stored = getPreferences().enabledSkillIds;
    return stored ?? skills.map((skill) => skill.id);
  });

  const toggle = (id: string) => {
    setEnabled((current) => {
      const next = current.includes(id)
        ? current.filter((skillId) => skillId !== id)
        : [...current, id];

      try {
        updatePreferences({ enabledSkillIds: next });
      } catch {
        // Settings are best-effort.
      }

      return next;
    });
  };

  if (skills.length === 0) {
    return (
      <text selectable={false}>
        No skills found. Add a SKILL.md under .tan.llm/skills/&lt;name&gt;/.
      </text>
    );
  }

  return (
    <DialogSearchList
      items={skills}
      onSelect={(skill) => toggle(skill.id)}
      filterFn={(skill, query) =>
        skill.name.toLowerCase().includes(query.toLowerCase()) ||
        skill.description.toLowerCase().includes(query.toLowerCase()) ||
        skill.id.toLowerCase().includes(query.toLowerCase())
      }
      renderItem={(skill, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {enabled.includes(skill.id) ? " • " : "   "}
          {skill.name}
          {skill.hidden ? " (hidden)" : ""}
          {" — "}
          {skill.description}
        </text>
      )}
      getKey={(skill) => skill.id}
      placeholder="Search skills"
      emptyText="No matching skills"
    />
  );
}
