// src/components/entity/EntitySelector.tsx

import React from "react";
import { Entity } from "../../types/Entity";

interface EntitySelectorProps {
  entities: Entity[];
  selectedEntityId: string | null;
  onSelect: (entityId: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function EntitySelector({
  entities,
  selectedEntityId,
  onSelect,
  disabled = false,
  className = "",
}: EntitySelectorProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor="entity-select" className="block text-sm font-medium text-gray-700 mb-1">
        Selecciona una entidad
      </label>
      <select
        id="entity-select"
        value={selectedEntityId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">-- Selecciona una entidad --</option>
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name}
          </option>
        ))}
      </select>
    </div>
  );
}