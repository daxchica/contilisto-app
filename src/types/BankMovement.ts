export interface BankMovement {

  id?: string;

  entityId: string;

  bankAccountId: string;

  date: string;

  amount: number;

  type: "deposit" | "withdrawal" | "transfer" | "out";

  description?: string;

  // 🔹 reconciliation layer
  statementId?: string;

  reconciliationStatus?: 
    | "pending"
    | "matched"
    | "manual";

  relatedJournalTransactionId?: string;

  createdAt?: number;
}