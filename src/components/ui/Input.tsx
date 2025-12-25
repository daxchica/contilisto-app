// src/components/ui/Input.tsx
import React from "react";

interface InputProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

export default function Input({
  label,
  value,
  disabled,
  onChange,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        className="border rounded-md px-3 py-2"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}