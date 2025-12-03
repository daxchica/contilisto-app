// src/components/clients/ClientFormModal.tsx
import React, { useState, useEffect } from "react";
import { 
    createClient, 
    updateClient, 
    Client,
    ClientInput 
} from "@/services/clientService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  entityId: string;
  initialData?: Client | null;
}

const emptyForm: ClientInput = {
  tipo_identificacion: "ruc",
  identificacion: "",
  razon_social: "",
  telefono: "",
  email: "",
  direccion: "",
  tipo_cliente: "regular",
};

const ClientFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  entityId,
  initialData,
}) => {
  const isEditing = Boolean(initialData);

  // FORM TIPADO CORRECTAMENTE
  const [form, setForm] = useState<ClientInput>(emptyForm);
  
  // CARGA DE DATOS EN MODO EDICIÓN
  useEffect(() => {
    if (initialData) {
        setForm({
            tipo_identificacion: initialData.tipo_identificacion,
            identificacion: initialData.identificacion,
            razon_social: initialData.razon_social,
            telefono: initialData.telefono ?? "",
            email: initialData.email ?? "",
            direccion: initialData.direccion ?? "",
            tipo_cliente: initialData.tipo_cliente ?? "regular",
        });
        } else if (isOpen) {
            setForm(emptyForm);
        }
  }, [initialData, isOpen]);


  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ 
        ...prev, 
        [e.target.name]: e.target.value 
    }));
  };

  const validate = () => {
    if (!form.razon_social.trim())
      return "Nombre o Razón Social es obligatorio";

    if (!form.identificacion.trim())
      return "Identificación es obligatoria";

    if (form.tipo_identificacion === "ruc" && form.identificacion.length !== 13)
      return "El RUC debe tener 13 dígitos";

    if (
      form.tipo_identificacion === "cedula" &&
      form.identificacion.length !== 10
    )
      return "La cédula debe tener 10 dígitos";

    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);

    try {
      if (isEditing && initialData) {
        await updateClient(entityId, initialData.id, form);
      } else {
        await createClient(entityId, form);
      }

      onSave();
      onClose();
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      alert("No se pudo guardar el cliente. Revisa permisos o la consola.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative">

        {/* HEADER */}
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
        </h2>

        {/* FORM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Tipo de identificación</label>
            <select
              name="tipo_identificacion"
              value={form.tipo_identificacion}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
            >
              <option value="ruc">RUC</option>
              <option value="cedula">Cédula</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Identificación</label>
            <input
              name="identificacion"
              value={form.identificacion ?? ""}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
              placeholder="RUC / Cédula / Pasaporte"
            />
          </div>

          <div className="md:col-span-2 flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Razón Social / Nombre</label>
            <input
              name="razon_social"
              value={form.razon_social ?? ""}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Teléfono</label>
            <input
              name="telefono"
              value={form.telefono ?? ""}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
              placeholder="0999999999"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Email</label>
            <input
              name="email"
              value={form.email ?? ""}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
              placeholder="cliente@correo.com"
            />
          </div>

          <div className="md:col-span-2 flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Dirección</label>
            <input
              name="direccion"
              value={form.direccion ?? ""}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
              placeholder="Dirección del cliente"
            />
          </div>

          <div className="md:col-span-2 flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Tipo de Cliente</label>
            <select
              name="tipo_cliente"
              value={form.tipo_cliente}
              onChange={handleChange}
              className="border rounded-lg px-3 py-2"
            >
              <option value="regular">Regular</option>
              <option value="preferencial">Preferencial</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-[#0A3558] text-white rounded-lg hover:bg-[#0c426f]"
          >
            {isEditing ? "Guardar Cambios" : "Crear Cliente"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ClientFormModal;