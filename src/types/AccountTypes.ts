// src/types/AccountTypes.ts

export interface Account {
  code: string;
  name: string;
  level: number;
  sign?: "positive" | "negative";
  isReceivable?: boolean;
  isPayable?: boolean;
  requiresThirdParty?: boolean;
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

export interface AccountWithBalance extends Account {
  debit: number;
  credit: number;
  balance: number;
  initialBalance?: number;
  parentCode?: string;
  children?: AccountWithBalance[];
}