import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import type { OpenRouterModel } from "@nightcode/shared";

type ModelsDialogContentProps = {
  models: OpenRouterModel[];
  onSelectModel: (modelId: string) => void;
};

export const ModelsDialogContent = ({ 
  models, 
  onSelectModel 
}: ModelsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (modelId: string) => {
      onSelectModel(modelId);
      dialog.close();
    },
    [dialog, onSelectModel],
  );

  return (
    <DialogSearchList
      items={models}
      onSelect={(model) => handleSelect(model.id)}
      filterFn={(model, query) => {
        const normalized = query.toLowerCase();
        return model.id.toLowerCase().includes(normalized)
          || model.name.toLowerCase().includes(normalized);
      }}
      renderItem={(model, isSelected) => (
        <text selectable={false} fg={isSelected ? "black" : "white"}>
          {model.name} ({model.id})
        </text>
      )}
      getKey={(model) => model.id}
      placeholder="Search models"
      emptyText="No matching models"
    />
  );
};
