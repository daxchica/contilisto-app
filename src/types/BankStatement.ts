export interface BankStatement {
  id?: string;

  entityId: string;
  bankAccountId: string;

  periodStart: string; // YYYY-MM-DD
  periodEnd: string;

  openingBalance: number;
  closingBalance: number;

  imported?: boolean;

  createdAt?: number;
  updatedAt?: number;
}