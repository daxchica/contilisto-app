// src/types/AccountTypes.ts

export interface Account {
  code: string;
  name: string;
}

/** Row stored in Firestore for user-defined accounts */
export interface CustomAccount extends Account {
  /** The parent account code this subaccount belongs to */
  parentCode: string;
  /** Redundant for rules/queries */
  entityId: string;
  /** Optional: who created it */
  userId?: string;
  createdAt?: number;
}

export type TipoCuenta = "activo" | "pasivo" | "patrimonio";