// src/types/Entity.ts
export type EntityType =
  | "comercial"
  | "primario"
  | "industrial"
  | "servicios profesionales"
  | "servicios generales"
  | "construccion"
  | "educacion"
  | "farmacia"
  | "otro";

export interface Entity {
  id?: string;            // Firestore document ID
  uid: string;            // User ID (dueno de la entidad)
  
  ruc: string;            // RUC de la empresa
  name: string;           // Nombre de la empresa
  type: EntityType;       // ✅ Debe estar presente
  
  address?: string;
  phone?: string;
  email?: string;

  createdAt: number;      // timestamp en milisegundos
  updatedAt?: number;
}

