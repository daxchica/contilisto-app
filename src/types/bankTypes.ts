// src/types/bankTypes.ts

export interface BankAccount {
  id?: string;
  entityId: string;
  name: string;
  number: string;
  currency: string;
  bankName: string;
  createdBy: string;
  createdAt: string;
  userId: string;
}

export interface BankBookEntry {
  id: string;
  entityId: string;
  bankAccountId: string;
  date: string;
  amount: number;
  type: "check" | "wire" | "manual";
  payee: string;
  description: string;
  status: "issued" | "cleared" | "postdated" | "voided";
  relatedTo?: "accountsPayable" | "expense";
  linkedDocumentId?: string;
  createdBy: string;
  createdAt: string;
}

// Movimiento bancario simple usado en conciliación
export interface BankMovement {
  id: string;
  entityId: string;
  bankAccountId?: string;
  date: string;          // ISO date string
  amount: number;        // positive value
  type: "INGRESO" | "EGRESO";
  description: string;
  status: "recorded" | "matched" | "pending" | "unknown";
  createdBy: string;
  createdAt: string;
}
