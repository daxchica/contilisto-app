// src/types/BankTypes.ts

export interface BankAccount {
  id: string;
  entityId: string;
  name: string;
  number: string;
  currency: string;
  bankName: string;
  createdBy: string;
  createdAt: string;
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