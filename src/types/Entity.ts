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
  
  email?: string;
  address?: string;
  phone?: string;
  
  obligadoContabilidad?: boolean;
  estab?: string;
  ptoEmi?: string;
  ambienteSri?: 1 | 2;

  createdAt: number;      // timestamp en milisegundos
  updatedAt?: number;
}

