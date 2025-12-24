// src/components/contacts/ContactFormModal.tsx
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { saveContact } from "@/services/contactService";
import type { Contact, IdentificationType, ContactRole, EntityType } from "@/types/Contact";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  entityId: string;
  initialData?: Contact | null;
}

export default function ContactFormModal({
  isOpen,
  onClose,
  onSave,
  entityId,
  initialData,
}: Props) {
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState<ContactRole>("cliente");

  const [identificationType, setIdentificationType] =
    useState<IdentificationType>("ruc");
  const [identification, setIdentification] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [entityType, setEntityType] = useState<EntityType>("comercial");

  useEffect(() => {
    if (!isOpen) return;

    if (!initialData) {
      setRole("cliente");
      setIdentificationType("ruc");
      setIdentification("");
      setName("");
      setEmail("");
      setAddress("");
      setPhone("");
      setEntityType("comercial");
      return;
    }

    setRole(initialData.role);
    setIdentificationType(initialData.identificationType);
    setIdentification(initialData.identification ?? "");
    setName(initialData.name ?? "");
    setEmail(initialData.email ?? "");
    setAddress(initialData.address ?? "");
    setPhone(initialData.phone ?? "");
    setEntityType(initialData.entityType ?? "comercial");
  }, [isOpen, initialData]);

  // SRI: email + address obligatorios (y name + identification)
  const validationMessage = useMemo(() => {
    if (!identification.trim()) return "Identificación es obligatoria.";
    if (!name.trim()) return "Nombre / Razón Social es obligatorio.";
    if (!email.trim()) return "Email es obligatorio (SRI).";
    if (!address.trim()) return "Dirección es obligatoria (SRI).";
    return null;
  }, [identification, name, email, address]);

  const handleSave = async () => {
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    try {
      setLoading(true);

      const payload: Omit<Contact, "id" | "createdAt" | "updatedAt"> = {
        entityId,
        role,

        identificationType,
        identification: identification.trim(),

        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        phone: phone.trim() ? phone.trim() : undefined,

        entityType: role === "empresa" ? entityType : undefined,

        activo: true,
      };

      await saveContact(entityId, payload, initialData?.id);

      onSave();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Error al guardar el contacto");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} maxWidthClass="max-w-lg">
      <h2 className="text-xl font-bold mb-4">
        {initialData ? "Editar Contacto" : "Nuevo Contacto"}
      </h2>

      <div className="space-y-4">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ContactRole)}
          className="w-full border rounded-lg px-4 py-3"
        >
          <option value="cliente">Cliente</option>
          <option value="proveedor">Proveedor</option>
          <option value="ambos">Cliente & Proveedor</option>
          <option value="empresa">Empresa (del sistema)</option>
        </select>

        <div className="flex gap-3">
          <select
            value={identificationType}
            onChange={(e) =>
              setIdentificationType(e.target.value as IdentificationType)
            }
            className="border rounded-lg px-3 py-3"
          >
            <option value="ruc">RUC</option>
            <option value="cedula">Cédula</option>
            <option value="pasaporte">Pasaporte</option>
            <option value="consumidor_final">Consumidor Final</option>
          </select>

          <input
            placeholder="Identificación *"
            value={identification}
            onChange={(e) => setIdentification(e.target.value)}
            className="flex-1 border rounded-lg px-4 py-3"
          />
        </div>

        <input
          placeholder="Nombre / Razón Social *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
        />

        <input
          placeholder="Email (SRI) *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
        />

        <input
          placeholder="Dirección (SRI) *"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
        />

        <input
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border rounded-lg px-4 py-3"
        />

        {role === "empresa" && (
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className="w-full border rounded-lg px-4 py-3"
          >
            <option value="comercial">Comercial</option>
            <option value="servicios">Servicios</option>
            <option value="industrial">Industrial</option>
            <option value="otro">Otro</option>
          </select>
        )}

        <p className="text-xs text-gray-500">
          * Campos obligatorios según normativa SRI (para emisión de comprobantes)
        </p>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="px-4 py-2 border rounded-lg">
          Cancelar
        </button>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}