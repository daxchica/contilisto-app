// src/components/CreateBankAccountModal.tsx
import React, { useEffect, useState } from "react";

export interface CreateBankAccountModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { name: string; number: string }) => Promise<void> | void;
}

export default function CreateBankAccountModal ({
  open,
  onClose,
  onConfirm,
}: CreateBankAccountModalProps) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setNumber("");
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !number.trim()) return;

    try {
      setSaving(true);
      await onConfirm({ name: name.trim(), number: number.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-account-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="create-account-title" className="text-lg font-semibold mb-2">
          Create account
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter the account details to add it to this entity.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="acctName" className="block text-sm font-medium">
              Account name
            </label>
            <input
              id="acctName"
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="acctNumber" className="block text-sm font-medium">
              Account number
            </label>
            <input
              id="acctNumber"
              className="mt-1 w-full border rounded px-3 py-2"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}