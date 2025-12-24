// src/types/Contact.ts

export type IdentificationType =
  | "ruc"
  | "cedula"
  | "pasaporte"
  | "consumidor_final";

export type ContactRole =
  | "cliente"
  | "proveedor"
  | "ambos"
  | "empresa"; // empresas del sistema

export type EntityType =
  | "comercial"
  | "servicios"
  | "industrial"
  | "otro";

export interface Contact {
  id: string;
  entityId: string;        // empresa propietaria

  // Rol único (NO objeto)
  role: ContactRole;

  // Identificación SRI
  identificationType: IdentificationType;
  identification: string; // RUC / cédula / pasaporte

  // Razón social / nombre
  name: string;

  // Contacto (SRI)
  email: string;          // 🔴 obligatorio
  address: string;        // 🔴 obligatorio
  phone?: string;         // opcional

  // Solo para role === "empresa"
  entityType?: EntityType;

  activo: boolean;

  createdAt: number;      // ISO
  updatedAt?: number;     // ISO
}