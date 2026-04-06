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

/* -------------------------------------------------------------------------- */
/* MEMBERS                                                                    */
/* -------------------------------------------------------------------------- */

export interface EntityMember {
  uid: string;
  role: "owner" | "accountant";
  invitedBy: string;
  createdAt: number;
}

/* -------------------------------------------------------------------------- */
/* TAX CONFIG (🔥 NEW)                                                        */
/* -------------------------------------------------------------------------- */

export type TaxAccountMap = {
  // SALES
  ventas12?: string[];
  ventas0?: string[];
  ivaVentas?: string[];

  // PURCHASES
  compras12?: string[];
  compras0?: string[];
  ivaCompras?: string[];

  // IVA RETENTIONS
  retIvaRecibidas?: string[];

  // FUTURE EXPANSION
  retRentaRecibidas?: string[];
  saldoCreditoAnterior?: string[];
};

/* -------------------------------------------------------------------------- */
/* ENTITY                                                                     */
/* -------------------------------------------------------------------------- */

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

  /* TAX CONFIG */
  taxConfig?: TaxAccountMap;

  createdAt: number;      // timestamp en milisegundos
  updatedAt?: number;

  members: {
    [uid: string]: EntityMember;
  }
}

