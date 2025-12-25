import { useState } from "react";
import type { Entity, EntityType } from "@/types/Entity";
import { updateEntity } from "@/services/entityService";

import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface Props {
  entity: Entity;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditEntityModal({ entity, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: entity.name,
    type: entity.type,
    address: entity.address ?? "",
    phone: entity.phone ?? "",
    email: entity.email ?? "",
  });

  const handleSave = async () => {
    await updateEntity(entity.id!, form);
    onSaved();
    onClose();
  };

  return (
    <Modal title="Editar Empresa" onClose={onClose}>
      <div className="space-y-4">
        <Input
          label="Nombre"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />

        <Input label="RUC" value={entity.ruc} disabled />

        <Input
          label="Tipo"
          value={form.type}
          onChange={(v) =>
            setForm({ ...form, type: v as EntityType })
          }
        />

        <Input
          label="Dirección"
          value={form.address}
          onChange={(v) => setForm({ ...form, address: v })}
        />

        <Input
          label="Teléfono"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
        />

        <Input
          label="Email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>
    </Modal>
  );
}