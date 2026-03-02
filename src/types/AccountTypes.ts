// src/types/AccountTypes.ts

export type Nature = "DEBIT" | "CREDIT";
export type TipoCuenta = "activo" | "pasivo" | "patrimonio";

/* -------------------------------------------------------------------------- */
/* RAW STRUCTURAL ACCOUNT (no intelligence yet)                               */
/* -------------------------------------------------------------------------- */

export interface RawAccount {
  code: string;
  name: string;

  parentCode?: string | null;

  // optional authored metadata (safe to include in RAW_COA)
  level?: number;
  postable?: boolean;

  nature?: Nature;
  taxType?: string;
  category?: string;

  rate?: number;
  percentage?: number;
  isDeductible?: boolean;

  sign?: "positive" | "negative";
  isReceivable?: boolean;
  isPayable?: boolean;
  requiresThirdParty?: boolean;
  isBank?: boolean;
}

/* -------------------------------------------------------------------------- */
/* NORMALIZED ACCOUNT (Runtime usage)                                                        */
/* -------------------------------------------------------------------------- */

export interface Account {
  code: string;
  name: string;
  level: number;

  parentCode?: string | null;

  isSystem?: boolean;

  // Accounting semantics
  nature?: Nature;
  taxType?: string;
  category?: string;

  rate?: number;
  percentage?: number;
  isDeductible?: boolean;

  // Existing business flags
  sign?: "positive" | "negative";
  isReceivable?: boolean;
  isPayable?: boolean;
  requiresThirdParty?: boolean;
  isBank?: boolean;

  createdAt?: any;
  updatedAt?: any;
}

/* -------------------------------------------------------------------------- */
/* ACCOUNT WITH BALANCE (Financial Reports)                                   */
/* -------------------------------------------------------------------------- */

export interface AccountWithBalance extends Account {
  debit: number;
  credit: number;
  balance: number;
  
  initialBalance?: number;
  children?: AccountWithBalance[];
}